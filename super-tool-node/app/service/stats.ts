import { Service } from 'egg';
import { Op } from 'sequelize';

export type TrendMetric = 'user-register' | 'user-login' | 'feedback-submit' | 'tool-access';
export type Granularity = 'day' | 'week' | 'month';

export interface TrendQuery {
  metric: TrendMetric;
  granularity?: Granularity;
  startTime?: string;
  endTime?: string;
}

export interface ToolUsageQuery {
  startTime?: string;
  endTime?: string;
  limit?: number;
}

export interface UserActiveQuery {
  startTime?: string;
  endTime?: string;
}

export type ExportType = 'tool-usage' | 'user-active' | 'trend';

const VALID_METRICS = new Set<TrendMetric>([
  'user-register', 'user-login', 'feedback-submit', 'tool-access',
]);
const VALID_GRANULARITIES = new Set<Granularity>(['day', 'week', 'month']);
const VALID_EXPORT_TYPES = new Set<ExportType>([
  'tool-usage', 'user-active', 'trend',
]);

export default class StatsService extends Service {
  // ============================================================
  // Public API
  // ============================================================

  /**
   * 大盘总览（8 字段）
   */
  async overview() {
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
    const sevenDaysAgo = new Date(Date.now() - 7 * 86400000);

    const [
      userCount, activeUserCount, todayLoginCount, activeSessionCount,
      toolCount, feedbackCount, pendingFeedbackCount, todayNewUserCount,
    ] = await Promise.all([
      this.ctx.model.User.count(),
      this._countActiveUsers(sevenDaysAgo),
      this.ctx.model.LoginLog.count({
        where: { status: 1, created_at: { [Op.gte]: todayStart } },
      }),
      this.ctx.model.UserSession.count({ where: { isActive: 1 } }),
      this.ctx.model.Tool.count({ where: { status: 1 } }),
      this.ctx.model.Feedback.count(),
      this.ctx.model.Feedback.count({ where: { status: 0 } }),
      this.ctx.model.User.count({
        where: { created_at: { [Op.gte]: todayStart } },
      }),
    ]);

    return {
      userCount, activeUserCount, todayLoginCount, activeSessionCount,
      toolCount, feedbackCount, pendingFeedbackCount, todayNewUserCount,
    };
  }

  /**
   * 工具使用 TOP N（从 api_logs 聚合）
   * - 路径模式 /api/tools/:code/access
   * - SUBSTRING_INDEX 提取 code 段
   * - 名称回填（避免 N+1）
   */
  async getToolUsage(q: ToolUsageQuery) {
    const { startTime, endTime } = this._parseTimeRange(q);
    const limit = Math.min(100, Math.max(1, q.limit || 20));

    const sql = `
      SELECT SUBSTRING_INDEX(SUBSTRING_INDEX(path, '/', 4), '/', -1) AS tool_code,
             COUNT(*) AS count
      FROM api_logs
      WHERE path LIKE '/api/tools/%/access'
        AND created_at BETWEEN :start AND :end
      GROUP BY tool_code
      ORDER BY count DESC
      LIMIT :limit
    `;
    const rows: any[] = (await (this.app as any).model.query(sql, {
      replacements: { start: startTime, end: endTime, limit },
      type: (this.app as any).Sequelize.QueryTypes.SELECT,
    })) as any[];

    // 名称回填
    const codes = rows.map((r: any) => r.tool_code).filter(Boolean);
    const tools = codes.length > 0
      ? await this.ctx.model.Tool.findAll({
          where: { code: codes }, attributes: ['code', 'name'],
        })
      : [];
    const nameMap = new Map((tools as any[]).map(t => [t.code, t.name]));

    return rows.map((r: any) => ({
      toolCode: r.tool_code,
      toolName: nameMap.get(r.tool_code) || '(已删除/未知)',
      count: Number(r.count),
    }));
  }

  /**
   * 用户活跃统计 — DAU / WAU / MAU + 新增用户趋势
   */
  async getUserActive(q: UserActiveQuery) {
    const { startTime, endTime } = this._parseTimeRange(q);
    const now = new Date();
    const dayAgo   = new Date(now.getTime() - 1  * 86400000);
    const weekAgo  = new Date(now.getTime() - 7  * 86400000);
    const monthAgo = new Date(now.getTime() - 30 * 86400000);

    const [dau, wau, mau, newUserPoints] = await Promise.all([
      this._countActiveUsers(dayAgo),
      this._countActiveUsers(weekAgo),
      this._countActiveUsers(monthAgo),
      this._getNewUserTrend(startTime, endTime),
    ]);

    return { dau, wau, mau, newUserTrend: newUserPoints };
  }

  /**
   * 通用趋势 — 4 metric × 3 granularity
   * - 白名单 switch 防 SQL 注入：metric / granularity 都来自固定枚举
   * - DATE_FORMAT 第二参数是字符串常量（来自 _bucketFormat 白名单），可安全拼接
   */
  async getTrend(q: TrendQuery) {
    const metric = q.metric;
    const granularity = q.granularity || 'day';
    const { startTime, endTime } = this._parseTimeRange(q);

    if (!VALID_METRICS.has(metric)) {
      this.ctx.throw(422, `invalid metric: ${metric}`);
    }
    if (!VALID_GRANULARITIES.has(granularity)) {
      this.ctx.throw(422, `invalid granularity: ${granularity}`);
    }

    const fmt = this._bucketFormat(granularity);
    const config = this._trendSqlConfig(metric);

    // fmt / config.* 全部来自硬编码枚举常量；replacements 只放 start/end
    const sql = `
      SELECT DATE_FORMAT(${config.timeColumn}, '${fmt}') AS bucket,
             COUNT(*) AS count
      FROM ${config.table}
      WHERE ${config.timeColumn} BETWEEN :start AND :end
        ${config.extraWhere || ''}
      GROUP BY bucket
      ORDER BY bucket ASC
    `;
    const rows: any[] = (await (this.app as any).model.query(sql, {
      replacements: { start: startTime, end: endTime },
      type: (this.app as any).Sequelize.QueryTypes.SELECT,
    })) as any[];

    return {
      metric, granularity,
      points: rows.map((r: any) => ({
        date: r.bucket, count: Number(r.count),
      })),
    };
  }

  /**
   * CSV 导出（复用 Spec-A1 PassThrough 模板）
   * - tool-usage / user-active / trend 三类
   * - UTF-8 BOM + 自实现 CSV 转义
   */
  async exportCsv(type: ExportType, q: any) {
    const { ctx } = this;
    if (!VALID_EXPORT_TYPES.has(type)) {
      ctx.throw(422, `invalid export type: ${type}`);
    }

    ctx.set('Content-Type', 'text/csv; charset=utf-8');
    ctx.set('Content-Disposition',
      `attachment; filename="stats-${type}-${Date.now()}.csv"`);

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { PassThrough } = require('stream');
    const stream = new PassThrough();
    ctx.body = stream;
    stream.write('\uFEFF');   // UTF-8 BOM

    if (type === 'tool-usage') {
      await this._exportToolUsage(stream, q);
    } else if (type === 'user-active') {
      await this._exportUserActive(stream, q);
    } else {
      await this._exportTrend(stream, q);
    }
    stream.end();
  }

  // ============================================================
  // Private helpers
  // ============================================================

  /** 解析时间范围（默认最近 30 天） */
  protected _parseTimeRange(q: { startTime?: string; endTime?: string }) {
    const now = new Date();
    const defaultStart = new Date(now.getTime() - 30 * 86400000);
    const startTime = q.startTime ? new Date(q.startTime) : defaultStart;
    const endTime = q.endTime ? new Date(q.endTime) : now;
    return { startTime, endTime };
  }

  /** 活跃用户数（去重 user_id，since 之后有过成功登录） */
  protected async _countActiveUsers(sinceDate: Date): Promise<number> {
    const sql = `
      SELECT COUNT(DISTINCT user_id) AS cnt
      FROM login_logs
      WHERE status = 1 AND created_at >= :sinceDate
    `;
    const rows: any[] = (await (this.app as any).model.query(sql, {
      replacements: { sinceDate },
      type: (this.app as any).Sequelize.QueryTypes.SELECT,
    })) as any[];
    return Number(rows[0]?.cnt || 0);
  }

  /** 新增用户趋势（按日 GROUP BY） */
  protected async _getNewUserTrend(start: Date, end: Date) {
    const sql = `
      SELECT DATE_FORMAT(created_at, '%Y-%m-%d') AS bucket,
             COUNT(*) AS count
      FROM users
      WHERE created_at BETWEEN :start AND :end
      GROUP BY bucket
      ORDER BY bucket ASC
    `;
    const rows: any[] = (await (this.app as any).model.query(sql, {
      replacements: { start, end },
      type: (this.app as any).Sequelize.QueryTypes.SELECT,
    })) as any[];
    return rows.map((r: any) => ({ date: r.bucket, count: Number(r.count) }));
  }

  /** granularity → MySQL DATE_FORMAT 模式（白名单 switch） */
  protected _bucketFormat(g: Granularity): string {
    switch (g) {
      case 'day':   return '%Y-%m-%d';
      case 'week':  return '%x-W%v';        // ISO 周（%x 年 + %v 周序号）
      case 'month': return '%Y-%m';
    }
  }

  /** metric → SQL 配置（表名 / 时间列 / 额外 WHERE） */
  protected _trendSqlConfig(metric: TrendMetric) {
    switch (metric) {
      case 'user-register':
        return { table: 'users', timeColumn: 'created_at', extraWhere: '' };
      case 'user-login':
        return { table: 'login_logs', timeColumn: 'created_at',
                 extraWhere: 'AND status = 1' };
      case 'feedback-submit':
        return { table: 'feedbacks', timeColumn: 'created_at',
                 extraWhere: 'AND deleted_at IS NULL' };
      case 'tool-access':
        return { table: 'api_logs', timeColumn: 'created_at',
                 extraWhere: "AND path LIKE '/api/tools/%/access'" };
    }
  }

  protected async _exportToolUsage(stream: any, q: any) {
    stream.write(['工具编码', '工具名称', '使用次数']
      .map(v => this._csvField(v)).join(',') + '\n');
    const data = await this.getToolUsage({ ...q, limit: 10000 });
    for (const row of data) {
      stream.write([row.toolCode, row.toolName, row.count]
        .map(v => this._csvField(v)).join(',') + '\n');
    }
  }

  protected async _exportUserActive(stream: any, q: any) {
    // 多段格式：[总览] + [新增用户趋势]
    const data = await this.getUserActive(q);
    stream.write('指标,值\n');
    stream.write(`DAU,${data.dau}\nWAU,${data.wau}\nMAU,${data.mau}\n\n`);
    stream.write('日期,新增数\n');
    for (const p of data.newUserTrend) {
      stream.write([p.date, p.count]
        .map(v => this._csvField(v)).join(',') + '\n');
    }
  }

  protected async _exportTrend(stream: any, q: any) {
    const data = await this.getTrend(q);
    stream.write(`指标,${this._csvField(data.metric)}\n`);
    stream.write(`粒度,${this._csvField(data.granularity)}\n\n`);
    stream.write('日期,数量\n');
    for (const p of data.points) {
      stream.write([p.date, p.count]
        .map(v => this._csvField(v)).join(',') + '\n');
    }
  }

  /** CSV 字段转义（与 audit.exportCsv 一致） */
  protected _csvField(v: any): string {
    if (v == null) return '';
    const s = String(v);
    if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  }

  // ============================================================
  // Dashboard Phase 1 — 业务分析扩展方法
  // ============================================================

  /**
   * 用户留存率
   */
  async getUserRetention(startDate: string, endDate: string) {
    const sequelize = this.ctx.model.User.sequelize!;
    const retentionDays = [1, 3, 7, 14, 30];

    const sql = `
      SELECT
        DATE(u.created_at) as cohort_date,
        COUNT(DISTINCT u.id) as total_users,
        ${retentionDays.map(d => `
          COUNT(DISTINCT CASE WHEN EXISTS (
            SELECT 1 FROM login_logs ll
            WHERE ll.user_id = u.id
              AND DATE(ll.created_at) = DATE_ADD(DATE(u.created_at), INTERVAL ${d} DAY)
              AND ll.status = 1
          ) THEN u.id END) as day_${d}_retained
        `).join(',')}
      FROM users u
      WHERE DATE(u.created_at) BETWEEN :startDate AND :endDate
        AND u.status = 1
      GROUP BY DATE(u.created_at)
      ORDER BY cohort_date DESC
    `;

    const results: any[] = await sequelize.query(sql, {
      replacements: { startDate, endDate },
      type: (sequelize as any).QueryTypes.SELECT,
    }) as any[];

    return {
      cohorts: results.map(row => ({
        date: row.cohort_date,
        totalUsers: Number(row.total_users),
        retention: {
          day1: row.total_users > 0 ? Math.round((row.day_1_retained / row.total_users) * 10000) / 100 : 0,
          day3: row.total_users > 0 ? Math.round((row.day_3_retained / row.total_users) * 10000) / 100 : 0,
          day7: row.total_users > 0 ? Math.round((row.day_7_retained / row.total_users) * 10000) / 100 : 0,
          day14: row.total_users > 0 ? Math.round((row.day_14_retained / row.total_users) * 10000) / 100 : 0,
          day30: row.total_users > 0 ? Math.round((row.day_30_retained / row.total_users) * 10000) / 100 : 0,
        },
      })),
    };
  }

  /**
   * 活跃时段分布 (24h × 7d 热力图数据)
   */
  async getActiveHours(days: number = 7) {
    const sequelize = this.ctx.model.User.sequelize!;
    const since = new Date(Date.now() - days * 86400000);

    const sql = `
      SELECT
        DAYOFWEEK(created_at) as day_of_week,
        HOUR(created_at) as hour,
        COUNT(DISTINCT user_id) as active_users
      FROM login_logs
      WHERE created_at >= :since AND status = 1
      GROUP BY DAYOFWEEK(created_at), HOUR(created_at)
      ORDER BY day_of_week, hour
    `;

    const results: any[] = await sequelize.query(sql, {
      replacements: { since },
      type: (sequelize as any).QueryTypes.SELECT,
    }) as any[];

    return {
      data: results.map(row => ({
        dayOfWeek: Number(row.day_of_week),
        hour: Number(row.hour),
        activeUsers: Number(row.active_users),
      })),
    };
  }

  /**
   * 工具分类使用统计
   */
  async getToolCategory(startDate?: string, endDate?: string) {
    const sequelize = this.ctx.model.User.sequelize!;
    const { startTime, endTime } = this._parseTimeRange({
      startTime: startDate, endTime: endDate,
    });

    const sql = `
      SELECT
        tc.name as category_name,
        tc.code as category_code,
        COUNT(*) as usage_count
      FROM api_logs al
      JOIN tools t ON SUBSTRING_INDEX(SUBSTRING_INDEX(al.path, '/', 4), '/', -1) = t.code
      JOIN tool_categories tc ON t.category_id = tc.id
      WHERE al.path LIKE '/api/tools/%/access'
        AND al.created_at BETWEEN :startTime AND :endTime
      GROUP BY tc.id, tc.name, tc.code
      ORDER BY usage_count DESC
    `;

    const results: any[] = await sequelize.query(sql, {
      replacements: { startTime, endTime },
      type: (sequelize as any).QueryTypes.SELECT,
    }) as any[];

    const total = results.reduce((sum: number, r: any) => sum + Number(r.usage_count), 0);

    return {
      categories: results.map(row => ({
        name: row.category_name,
        code: row.category_code,
        usageCount: Number(row.usage_count),
        percentage: total > 0 ? Math.round((Number(row.usage_count) / total) * 10000) / 100 : 0,
      })),
    };
  }

  /**
   * 运营效率指标
   */
  async getOperationEfficiency(startDate?: string, endDate?: string) {
    const sequelize = this.ctx.model.User.sequelize!;
    const { startTime, endTime } = this._parseTimeRange({
      startTime: startDate, endTime: endDate,
    });

    // 1. 反馈平均响应时间 (按周)
    const feedbackResponseSql = `
      SELECT
        YEARWEEK(created_at, 1) as week_num,
        MIN(DATE(created_at)) as week_start,
        AVG(TIMESTAMPDIFF(HOUR, created_at, updated_at)) as avg_hours
      FROM feedbacks
      WHERE status >= 1
        AND created_at BETWEEN :startTime AND :endTime
      GROUP BY YEARWEEK(created_at, 1)
      ORDER BY week_num
    `;
    const feedbackResponse: any[] = await sequelize.query(feedbackResponseSql, {
      replacements: { startTime, endTime },
      type: (sequelize as any).QueryTypes.SELECT,
    }) as any[];

    // 2. 反馈完成率
    const [totalFeedback, completedFeedback] = await Promise.all([
      this.ctx.model.Feedback.count({
        where: { created_at: { [Op.between]: [startTime, endTime] } },
      }),
      this.ctx.model.Feedback.count({
        where: { status: 3, created_at: { [Op.between]: [startTime, endTime] } },
      }),
    ]);

    // 3. 会员转化漏斗
    const funnelSql = `
      SELECT
        (SELECT COUNT(*) FROM users WHERE status = 1) as registered,
        (SELECT COUNT(DISTINCT user_id) FROM login_logs WHERE status = 1) as logged_in,
        (SELECT COUNT(DISTINCT user_id) FROM api_logs WHERE path LIKE '/api/tools/%/access') as used_tool,
        (SELECT COUNT(*) FROM user_members WHERE is_paid = 1) as paid_member
    `;
    const funnelResult: any[] = await sequelize.query(funnelSql, {
      type: (sequelize as any).QueryTypes.SELECT,
    }) as any[];

    return {
      feedbackResponse: feedbackResponse.map(r => ({
        week: r.week_start,
        avgHours: Math.round(Number(r.avg_hours) * 10) / 10,
      })),
      feedbackCompletion: {
        total: totalFeedback,
        completed: completedFeedback,
        rate: totalFeedback > 0 ? Math.round((completedFeedback / totalFeedback) * 10000) / 100 : 0,
      },
      memberConversion: {
        registered: Number(funnelResult[0]?.registered || 0),
        loggedIn: Number(funnelResult[0]?.logged_in || 0),
        usedTool: Number(funnelResult[0]?.used_tool || 0),
        paidMember: Number(funnelResult[0]?.paid_member || 0),
      },
    };
  }

  /**
   * 用户增长 (按注册渠道分组)
   */
  async getUserGrowth(startDate?: string, endDate?: string, granularity: Granularity = 'day') {
    const sequelize = this.ctx.model.User.sequelize!;
    const { startTime, endTime } = this._parseTimeRange({
      startTime: startDate, endTime: endDate,
    });
    const bucketFormat = this._bucketFormat(granularity);

    const sql = `
      SELECT
        DATE_FORMAT(created_at, '${bucketFormat}') as date,
        COALESCE(register_source, 'unknown') as source,
        COUNT(*) as count
      FROM users
      WHERE created_at BETWEEN :startTime AND :endTime
        AND status = 1
      GROUP BY DATE_FORMAT(created_at, '${bucketFormat}'), register_source
      ORDER BY date, source
    `;

    const results: any[] = await sequelize.query(sql, {
      replacements: { startTime, endTime },
      type: (sequelize as any).QueryTypes.SELECT,
    }) as any[];

    return {
      data: results.map(row => ({
        date: row.date,
        source: row.source,
        count: Number(row.count),
      })),
    };
  }

  // ============================================================
  // Dashboard Phase 2 — 部门级数据视图
  // ============================================================

  /**
   * 各部门(角色)概览数据
   * @param roleIds 可选，限定部门角色ID
   */
  async getDepartmentOverview(roleIds?: number[]) {
    const sequelize = this.ctx.model.User.sequelize!;
    const sevenDaysAgo = new Date(Date.now() - 7 * 86400000);

    // 获取所有部门角色
    let roleFilter = "r.role_category = 'department'";
    const replacements: any = { sevenDaysAgo };
    if (roleIds && roleIds.length > 0) {
      roleFilter += ' AND r.id IN (:roleIds)';
      replacements.roleIds = roleIds;
    }

    const sql = `
      SELECT
        r.id as role_id,
        r.name as role_name,
        r.code as role_code,
        COUNT(DISTINCT ur.user_id) as member_count,
        COUNT(DISTINCT CASE WHEN ll.created_at >= :sevenDaysAgo THEN ll.user_id END) as active_count,
        COUNT(DISTINCT al.id) as tool_usage_count,
        COUNT(DISTINCT CASE WHEN um.is_paid = 1 THEN um.user_id END) as paid_member_count
      FROM roles r
      LEFT JOIN user_roles ur ON r.id = ur.role_id
      LEFT JOIN login_logs ll ON ur.user_id = ll.user_id AND ll.status = 1 AND ll.created_at >= :sevenDaysAgo
      LEFT JOIN api_logs al ON ur.user_id = al.user_id AND al.path LIKE '/api/tools/%/access' AND al.created_at >= :sevenDaysAgo
      LEFT JOIN user_members um ON ur.user_id = um.user_id
      WHERE ${roleFilter}
      GROUP BY r.id, r.name, r.code
      ORDER BY member_count DESC
    `;

    const results: any[] = await sequelize.query(sql, {
      replacements,
      type: (sequelize as any).QueryTypes.SELECT,
    }) as any[];

    return {
      departments: results.map(row => {
        const memberCount = Number(row.member_count) || 0;
        const activeCount = Number(row.active_count) || 0;
        const toolUsage = Number(row.tool_usage_count) || 0;
        const paidCount = Number(row.paid_member_count) || 0;
        return {
          roleId: row.role_id,
          roleName: row.role_name,
          roleCode: row.role_code,
          memberCount,
          activeRate: memberCount > 0 ? Math.round((activeCount / memberCount) * 10000) / 100 : 0,
          toolUsagePerCapita: memberCount > 0 ? Math.round((toolUsage / memberCount) * 100) / 100 : 0,
          paidMemberRate: memberCount > 0 ? Math.round((paidCount / memberCount) * 10000) / 100 : 0,
        };
      }),
    };
  }

  /**
   * 部门数据对比趋势
   */
  async getDepartmentCompare(roleIds: number[], metric: string = 'active', startDate?: string, endDate?: string) {
    const sequelize = this.ctx.model.User.sequelize!;
    const { startTime, endTime } = this._parseTimeRange({ startTime: startDate, endTime: endDate });

    if (!roleIds || roleIds.length === 0) {
      return { series: [] };
    }

    let metricSql: string;
    switch (metric) {
      case 'tool_usage':
        metricSql = `COUNT(DISTINCT al.id)`;
        break;
      case 'active':
      default:
        metricSql = `COUNT(DISTINCT ll.user_id)`;
        break;
    }

    const sql = `
      SELECT
        r.id as role_id,
        r.name as role_name,
        DATE_FORMAT(ll.created_at, '%Y-%m-%d') as date,
        ${metricSql} as value
      FROM roles r
      JOIN user_roles ur ON r.id = ur.role_id
      LEFT JOIN login_logs ll ON ur.user_id = ll.user_id AND ll.status = 1
        AND ll.created_at BETWEEN :startTime AND :endTime
      LEFT JOIN api_logs al ON ur.user_id = al.user_id
        AND al.path LIKE '/api/tools/%/access'
        AND al.created_at BETWEEN :startTime AND :endTime
      WHERE r.id IN (:roleIds) AND r.role_category = 'department'
      GROUP BY r.id, r.name, DATE_FORMAT(ll.created_at, '%Y-%m-%d')
      HAVING date IS NOT NULL
      ORDER BY date
    `;

    const results: any[] = await sequelize.query(sql, {
      replacements: { roleIds, startTime, endTime },
      type: (sequelize as any).QueryTypes.SELECT,
    }) as any[];

    // 按角色分组
    const seriesMap = new Map<number, { roleId: number; roleName: string; data: any[] }>();
    for (const row of results) {
      if (!seriesMap.has(row.role_id)) {
        seriesMap.set(row.role_id, { roleId: row.role_id, roleName: row.role_name, data: [] });
      }
      seriesMap.get(row.role_id)!.data.push({
        date: row.date,
        value: Number(row.value),
      });
    }

    return { series: Array.from(seriesMap.values()) };
  }

  /**
   * 跨部门协作数据（共同使用工具的重合度）
   */
  async getDepartmentCollaboration(roleIds?: number[]) {
    const sequelize = this.ctx.model.User.sequelize!;
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000);

    let roleFilter = "r1.role_category = 'department' AND r2.role_category = 'department'";
    const replacements: any = { thirtyDaysAgo };
    if (roleIds && roleIds.length > 0) {
      roleFilter += ' AND r1.id IN (:roleIds) AND r2.id IN (:roleIds)';
      replacements.roleIds = roleIds;
    }

    const sql = `
      SELECT
        r1.id as source_id,
        r1.name as source_name,
        r2.id as target_id,
        r2.name as target_name,
        COUNT(DISTINCT SUBSTRING_INDEX(SUBSTRING_INDEX(al1.path, '/', 4), '/', -1)) as shared_tools
      FROM roles r1
      JOIN user_roles ur1 ON r1.id = ur1.role_id
      JOIN api_logs al1 ON ur1.user_id = al1.user_id
        AND al1.path LIKE '/api/tools/%/access'
        AND al1.created_at >= :thirtyDaysAgo
      JOIN roles r2 ON r2.id > r1.id
      JOIN user_roles ur2 ON r2.id = ur2.role_id
      JOIN api_logs al2 ON ur2.user_id = al2.user_id
        AND al2.path LIKE '/api/tools/%/access'
        AND al2.created_at >= :thirtyDaysAgo
        AND SUBSTRING_INDEX(SUBSTRING_INDEX(al1.path, '/', 4), '/', -1) = SUBSTRING_INDEX(SUBSTRING_INDEX(al2.path, '/', 4), '/', -1)
      WHERE ${roleFilter}
      GROUP BY r1.id, r1.name, r2.id, r2.name
      HAVING shared_tools > 0
      ORDER BY shared_tools DESC
    `;

    const results: any[] = await sequelize.query(sql, {
      replacements,
      type: (sequelize as any).QueryTypes.SELECT,
    }) as any[];

    return {
      links: results.map(row => ({
        source: row.source_name,
        target: row.target_name,
        sourceId: row.source_id,
        targetId: row.target_id,
        sharedTools: Number(row.shared_tools),
      })),
    };
  }
}
