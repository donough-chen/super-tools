import { Service } from 'egg';
import { Op } from 'sequelize';

export default class DashboardService extends Service {
  /**
   * 获取系统运行状态
   */
  async getSystemStatus() {
    const oneHourAgo = new Date(Date.now() - 3600000);

    // MySQL 状态检测
    let mysqlStatus: { status: 'ok' | 'error'; latency: number } = { status: 'ok', latency: 0 };
    try {
      const start = Date.now();
      await this.ctx.model.User.sequelize!.authenticate();
      mysqlStatus.latency = Date.now() - start;
    } catch {
      mysqlStatus = { status: 'error', latency: -1 };
    }

    // Redis 状态检测
    let redisStatus: { status: 'ok' | 'error'; latency: number } = { status: 'ok', latency: 0 };
    try {
      const start = Date.now();
      await this.app.redis.ping();
      redisStatus.latency = Date.now() - start;
    } catch {
      redisStatus = { status: 'error', latency: -1 };
    }

    // API 统计 (最近1小时)
    const [totalRequests, errorRequests] = await Promise.all([
      this.ctx.model.ApiLog.count({
        where: { created_at: { [Op.gte]: oneHourAgo } },
      }),
      this.ctx.model.ApiLog.count({
        where: { created_at: { [Op.gte]: oneHourAgo }, status: { [Op.gte]: 400 } },
      }),
    ]);

    const errorRate = totalRequests > 0 ? (errorRequests / totalRequests) * 100 : 0;

    // 平均响应时间
    const responseTimeResult = await this.ctx.model.ApiLog.findAll({
      attributes: [
        [this.ctx.model.ApiLog.sequelize!.fn('AVG',
          this.ctx.model.ApiLog.sequelize!.col('response_time')), 'avg'],
      ],
      where: { created_at: { [Op.gte]: oneHourAgo } },
      raw: true,
    }) as any[];

    const avgResponseTime = responseTimeResult[0]?.avg || 0;

    // 活跃会话数
    const activeSessionCount = await this.ctx.model.UserSession.count({
      where: { is_active: 1 },
    });

    return {
      mysql: mysqlStatus,
      redis: redisStatus,
      api: {
        totalRequests,
        errorRequests,
        errorRate: Math.round(errorRate * 100) / 100,
        avgResponseTime: Math.round(Number(avgResponseTime)),
      },
      activeSessionCount,
    };
  }
}
