import { Service } from 'egg';
import { Op } from 'sequelize';

export default class AlertService extends Service {

  // ==================== 规则 CRUD ====================

  async listRules(query: any = {}) {
    const where: any = {};
    if (query.severity) where.severity = query.severity;
    if (query.is_enabled !== undefined) where.isEnabled = Number(query.is_enabled);
    if (query.metric_type) where.metricType = query.metric_type;

    const { page = 1, pageSize = 20 } = query;
    const offset = (Number(page) - 1) * Number(pageSize);

    const { count, rows } = await this.ctx.model.AlertRule.findAndCountAll({
      where,
      order: [['created_at', 'DESC']],
      limit: Number(pageSize),
      offset,
    });

    return { list: rows, total: count };
  }

  async createRule(data: any) {
    return await this.ctx.model.AlertRule.create(data);
  }

  async updateRule(id: number, data: any) {
    const rule = await this.ctx.model.AlertRule.findByPk(id);
    if (!rule) this.ctx.throw(404, '规则不存在');
    await rule.update(data);
    return rule;
  }

  async deleteRule(id: number) {
    const rule = await this.ctx.model.AlertRule.findByPk(id);
    if (!rule) this.ctx.throw(404, '规则不存在');
    await rule.destroy();
  }

  async toggleRule(id: number) {
    const rule = await this.ctx.model.AlertRule.findByPk(id);
    if (!rule) this.ctx.throw(404, '规则不存在');
    const newVal = (rule as any).isEnabled ? 0 : 1;
    await rule.update({ isEnabled: newVal });
    return { isEnabled: newVal };
  }

  // ==================== 告警记录 ====================

  async listLogs(query: any = {}) {
    const where: any = {};
    if (query.severity) where.severity = query.severity;
    if (query.status) where.status = query.status;
    if (query.start_date && query.end_date) {
      where.createdAt = { [Op.between]: [query.start_date, query.end_date] };
    }

    const { page = 1, pageSize = 20 } = query;
    const offset = (Number(page) - 1) * Number(pageSize);

    const { count, rows } = await this.ctx.model.AlertLog.findAndCountAll({
      where,
      order: [['created_at', 'DESC']],
      limit: Number(pageSize),
      offset,
    });

    return { list: rows, total: count };
  }

  async acknowledgeLog(id: number, userId: number) {
    const log = await this.ctx.model.AlertLog.findByPk(id);
    if (!log) this.ctx.throw(404, '告警记录不存在');
    await log.update({
      status: 'acknowledged',
      acknowledgedBy: userId,
      acknowledgedAt: new Date(),
    });
    return log;
  }

  async resolveLog(id: number, resolveNote?: string) {
    const log = await this.ctx.model.AlertLog.findByPk(id);
    if (!log) this.ctx.throw(404, '告警记录不存在');
    await log.update({
      status: 'resolved',
      resolvedAt: new Date(),
      resolveNote: resolveNote || null,
    });
    return log;
  }

  async getSummary() {
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
    const sevenDaysAgo = new Date(Date.now() - 7 * 86400000);

    const [firingCritical, firingWarning, firingInfo, todayTotal] = await Promise.all([
      this.ctx.model.AlertLog.count({ where: { status: 'firing', severity: 'critical' } }),
      this.ctx.model.AlertLog.count({ where: { status: 'firing', severity: 'warning' } }),
      this.ctx.model.AlertLog.count({ where: { status: 'firing', severity: 'info' } }),
      this.ctx.model.AlertLog.count({ where: { created_at: { [Op.gte]: todayStart } } }),
    ]);

    // 最近7天趋势
    const sequelize = this.ctx.model.AlertLog.sequelize!;
    const trendResults: any[] = await sequelize.query(`
      SELECT DATE(created_at) as date, COUNT(*) as count
      FROM alert_logs
      WHERE created_at >= :since
      GROUP BY DATE(created_at)
      ORDER BY date
    `, {
      replacements: { since: sevenDaysAgo },
      type: (sequelize as any).QueryTypes.SELECT,
    }) as any[];

    return {
      firing: { critical: firingCritical, warning: firingWarning, info: firingInfo },
      todayTotal,
      trend: trendResults.map(r => ({ date: r.date, count: Number(r.count) })),
    };
  }

  // ==================== 告警检测引擎 ====================

  async checkAllRules() {
    const rules = await this.ctx.model.AlertRule.findAll({
      where: { is_enabled: 1 },
    });

    for (const rule of rules as any[]) {
      try {
        if (this.isInCooldown(rule)) continue;

        const currentValue = await this.collectMetric(rule.metricType, rule.timeWindow);
        const triggered = await this.evaluateCondition(rule, currentValue);

        if (triggered) {
          await this.fireAlert(rule, currentValue);
        }
      } catch (err) {
        this.ctx.logger.error(`[Alert] 检测规则 ${rule.name} 失败:`, err);
      }
    }
  }

  private isInCooldown(rule: any): boolean {
    if (!rule.lastTriggeredAt) return false;
    const cooldownMs = (rule.cooldownMinutes || 30) * 60000;
    return Date.now() - new Date(rule.lastTriggeredAt).getTime() < cooldownMs;
  }

  private async collectMetric(metricType: string, timeWindow: number): Promise<number> {
    const since = new Date(Date.now() - timeWindow * 60000);

    switch (metricType) {
      case 'error_rate': {
        const total = await this.ctx.model.ApiLog.count({
          where: { created_at: { [Op.gte]: since } },
        });
        const errors = await this.ctx.model.ApiLog.count({
          where: { status: { [Op.gte]: 400 }, created_at: { [Op.gte]: since } },
        });
        return total > 0 ? (errors / total) * 100 : 0;
      }
      case 'active_user': {
        const sequelize = this.ctx.model.LoginLog.sequelize!;
        const result: any[] = await sequelize.query(
          'SELECT COUNT(DISTINCT user_id) as cnt FROM login_logs WHERE status=1 AND created_at >= :since',
          { replacements: { since }, type: (sequelize as any).QueryTypes.SELECT },
        ) as any[];
        return Number(result[0]?.cnt || 0);
      }
      case 'new_user':
        return await this.ctx.model.User.count({
          where: { created_at: { [Op.gte]: since } },
        });
      case 'tool_usage':
        return await this.ctx.model.ApiLog.count({
          where: { path: { [Op.like]: '/api/tools/%/access' }, created_at: { [Op.gte]: since } },
        });
      case 'response_time': {
        const result = await this.ctx.model.ApiLog.findAll({
          attributes: [[this.ctx.model.ApiLog.sequelize!.fn('AVG',
            this.ctx.model.ApiLog.sequelize!.col('response_time')), 'avg']],
          where: { created_at: { [Op.gte]: since } },
          raw: true,
        }) as any[];
        return Number(result[0]?.avg || 0);
      }
      case 'feedback_pending':
        return await this.ctx.model.Feedback.count({ where: { status: 0 } });
      case 'member_expire': {
        const expireDate = new Date(Date.now() + 7 * 86400000);
        return await this.ctx.model.UserMember.count({
          where: { is_paid: 1, paid_expire_at: { [Op.between]: [new Date(), expireDate] } },
        });
      }
      case 'session_count':
        return await this.ctx.model.UserSession.count({ where: { is_active: 1 } });
      default:
        return 0;
    }
  }

  private async evaluateCondition(rule: any, currentValue: number): Promise<boolean> {
    const threshold = Number(rule.threshold);

    switch (rule.conditionType) {
      case 'gt':  return currentValue > threshold;
      case 'lt':  return currentValue < threshold;
      case 'gte': return currentValue >= threshold;
      case 'lte': return currentValue <= threshold;
      case 'change_rate_up':
      case 'change_rate_down': {
        const previousValue = await this.getPreviousValue(rule);
        if (previousValue === 0) return false;
        const changeRate = ((currentValue - previousValue) / previousValue) * 100;
        if (rule.conditionType === 'change_rate_up') return changeRate > threshold;
        return changeRate < -threshold;
      }
      default: return false;
    }
  }

  private async getPreviousValue(rule: any): Promise<number> {
    const compareMs = (rule.compareWindow || 1440) * 60000;
    const previousStart = new Date(Date.now() - compareMs - rule.timeWindow * 60000);
    const previousEnd = new Date(Date.now() - compareMs);

    // 简化：用相同的 metric 查询上一个时间窗口
    switch (rule.metricType) {
      case 'new_user':
        return await this.ctx.model.User.count({
          where: { created_at: { [Op.between]: [previousStart, previousEnd] } },
        });
      case 'active_user': {
        const sequelize = this.ctx.model.LoginLog.sequelize!;
        const result: any[] = await sequelize.query(
          'SELECT COUNT(DISTINCT user_id) as cnt FROM login_logs WHERE status=1 AND created_at BETWEEN :start AND :end',
          { replacements: { start: previousStart, end: previousEnd }, type: (sequelize as any).QueryTypes.SELECT },
        ) as any[];
        return Number(result[0]?.cnt || 0);
      }
      default:
        return 0;
    }
  }

  private async fireAlert(rule: any, currentValue: number) {
    const conditionLabels: Record<string, string> = {
      gt: '>', lt: '<', gte: '>=', lte: '<=',
      change_rate_up: '环比上升超过', change_rate_down: '环比下降超过',
    };
    const conditionDesc = `${rule.name}: 当前值 ${Math.round(currentValue * 100) / 100} ${conditionLabels[rule.conditionType] || ''} 阈值 ${rule.threshold}`;

    // 1. 写入告警记录
    await this.ctx.model.AlertLog.create({
      ruleId: rule.id,
      ruleName: rule.name,
      metricType: rule.metricType,
      metricValue: Math.round(currentValue * 100) / 100,
      thresholdValue: rule.threshold,
      conditionDesc,
      severity: rule.severity,
      status: 'firing',
      details: { timeWindow: rule.timeWindow, conditionType: rule.conditionType },
    });

    // 2. 更新规则的上次触发时间
    await rule.update({ lastTriggeredAt: new Date() });

    this.ctx.logger.warn(`[Alert] 触发告警: ${conditionDesc}`);
  }
}
