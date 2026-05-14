import { Service } from 'egg';
import { Op } from 'sequelize';

export default class DashboardService extends Service {
  /**
   * 获取系统运行状态
   */
  async getSystemStatus() {
    const oneHourAgo = new Date(Date.now() - 3600000);

    let mysqlStatus: { status: 'ok' | 'error'; latency: number } = { status: 'ok', latency: 0 };
    try {
      const start = Date.now();
      await this.ctx.model.User.sequelize!.authenticate();
      mysqlStatus.latency = Date.now() - start;
    } catch {
      mysqlStatus = { status: 'error', latency: -1 };
    }

    let redisStatus: { status: 'ok' | 'error'; latency: number } = { status: 'ok', latency: 0 };
    try {
      const start = Date.now();
      await this.app.redis.ping();
      redisStatus.latency = Date.now() - start;
    } catch {
      redisStatus = { status: 'error', latency: -1 };
    }

    const [totalRequests, errorRequests] = await Promise.all([
      this.ctx.model.ApiLog.count({ where: { created_at: { [Op.gte]: oneHourAgo } } }),
      this.ctx.model.ApiLog.count({ where: { created_at: { [Op.gte]: oneHourAgo }, response_code: { [Op.gte]: 400 } } }),
    ]);

    const errorRate = totalRequests > 0 ? (errorRequests / totalRequests) * 100 : 0;

    const responseTimeResult = await this.ctx.model.ApiLog.findAll({
      attributes: [[this.ctx.model.ApiLog.sequelize!.fn('AVG',
        this.ctx.model.ApiLog.sequelize!.col('cost_time')), 'avg']],
      where: { created_at: { [Op.gte]: oneHourAgo } },
      raw: true,
    }) as any[];

    const avgResponseTime = responseTimeResult[0]?.avg || 0;
    const activeSessionCount = await this.ctx.model.UserSession.count({ where: { is_active: 1 } });

    return {
      mysql: mysqlStatus,
      redis: redisStatus,
      api: {
        totalRequests, errorRequests,
        errorRate: Math.round(errorRate * 100) / 100,
        avgResponseTime: Math.round(Number(avgResponseTime)),
      },
      activeSessionCount,
    };
  }

  // ==================== Phase 5: 移动端适配 ====================

  /**
   * 移动端精简数据摘要
   */
  async getMobileSummary() {
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
    const yesterdayStart = new Date(todayStart.getTime() - 86400000);
    const sevenDaysAgo = new Date(Date.now() - 7 * 86400000);

    // 核心 KPI
    const [userCount, todayLogin, todayNew, activeUsers, toolUsage, pendingFeedback] = await Promise.all([
      this.ctx.model.User.count(),
      this.ctx.model.LoginLog.count({ where: { status: 1, created_at: { [Op.gte]: todayStart } } }),
      this.ctx.model.User.count({ where: { created_at: { [Op.gte]: todayStart } } }),
      this.ctx.model.LoginLog.count({
        where: { status: 1, created_at: { [Op.gte]: sevenDaysAgo } },
        distinct: true, col: 'user_id',
      }),
      this.ctx.model.ApiLog.count({
        where: { path: { [Op.like]: '/api/tools/%/access' }, created_at: { [Op.gte]: todayStart } },
      }),
      this.ctx.model.Feedback.count({ where: { status: 0 } }),
    ]);

    // 昨日同期对比
    const [yesterdayLogin, yesterdayNew] = await Promise.all([
      this.ctx.model.LoginLog.count({
        where: { status: 1, created_at: { [Op.between]: [yesterdayStart, todayStart] } },
      }),
      this.ctx.model.User.count({
        where: { created_at: { [Op.between]: [yesterdayStart, todayStart] } },
      }),
    ]);

    const calcChange = (today: number, yesterday: number) => {
      if (yesterday === 0) return today > 0 ? 100 : 0;
      return Math.round(((today - yesterday) / yesterday) * 10000) / 100;
    };

    const kpis = [
      { key: 'userCount', label: '用户总数', value: userCount, trend: 'flat' as const },
      { key: 'todayLogin', label: '今日活跃', value: todayLogin, change: calcChange(todayLogin, yesterdayLogin), trend: todayLogin >= yesterdayLogin ? 'up' as const : 'down' as const },
      { key: 'todayNew', label: '今日新增', value: todayNew, change: calcChange(todayNew, yesterdayNew), trend: todayNew >= yesterdayNew ? 'up' as const : 'down' as const },
      { key: 'activeUsers', label: '7日活跃', value: activeUsers, trend: 'flat' as const },
      { key: 'toolUsage', label: '工具使用', value: toolUsage, trend: 'flat' as const },
      { key: 'pendingFeedback', label: '待处理反馈', value: pendingFeedback, trend: 'flat' as const },
    ];

    // 今日vs昨日每小时对比
    const sequelize = this.ctx.model.LoginLog.sequelize!;
    const hourlyResult: any[] = await sequelize.query(`
      SELECT
        HOUR(created_at) as hour,
        SUM(CASE WHEN DATE(created_at) = CURDATE() THEN 1 ELSE 0 END) as today,
        SUM(CASE WHEN DATE(created_at) = DATE_SUB(CURDATE(), INTERVAL 1 DAY) THEN 1 ELSE 0 END) as yesterday
      FROM login_logs
      WHERE status = 1 AND created_at >= DATE_SUB(CURDATE(), INTERVAL 1 DAY)
      GROUP BY HOUR(created_at)
      ORDER BY hour
    `, { type: (sequelize as any).QueryTypes.SELECT }) as any[];

    const todayVsYesterday = hourlyResult.map(r => ({
      hour: `${r.hour}:00`,
      today: Number(r.today),
      yesterday: Number(r.yesterday),
    }));

    // 最新告警
    const latestAlerts = await this.ctx.model.AlertLog.findAll({
      where: { status: 'firing' },
      order: [['created_at', 'DESC']],
      limit: 3,
      raw: true,
    });

    return {
      kpis,
      todayVsYesterday,
      latestAlerts,
      quickLinks: [
        { key: 'users', label: '用户管理', icon: 'UserOutlined', path: '/user/list' },
        { key: 'tools', label: '工具管理', icon: 'ToolOutlined', path: '/tool/list' },
        { key: 'feedback', label: '反馈管理', icon: 'MessageOutlined', path: '/feedback/list' },
        { key: 'stats', label: '详细报表', icon: 'BarChartOutlined', path: '/dashboard/analytics' },
        { key: 'alerts', label: '告警中心', icon: 'AlertOutlined', path: '/dashboard/alerts' },
      ],
    };
  }

  /**
   * 获取推送偏好设置
   */
  async getPushSettings(userId: number) {
    const cacheKey = `push_settings:${userId}`;
    const cached = await this.app.redis.get(cacheKey);
    if (cached) return JSON.parse(cached);

    // 默认设置
    return {
      enabled: true,
      channels: { websocket: true, notification: true, email: false },
      filters: { severity: ['critical', 'warning'], quietHours: { start: '22:00', end: '08:00' } },
      dailySummary: { enabled: true, time: '09:00' },
    };
  }

  /**
   * 保存推送偏好设置
   */
  async savePushSettings(userId: number, settings: any) {
    const cacheKey = `push_settings:${userId}`;
    await this.app.redis.set(cacheKey, JSON.stringify(settings));
    return settings;
  }
}
