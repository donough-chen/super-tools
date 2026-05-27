import { Subscription } from 'egg';

/**
 * 积分过期清零定时任务
 *  每日 02:00 执行（业务低峰期）
 */
export default class PointsExpireSchedule extends Subscription {
  static get schedule() {
    return {
      cron: '0 0 2 * * *',
      type: 'worker',
      immediate: false,
    };
  }

  async subscribe() {
    const { ctx } = this;
    try {
      const r = await (ctx.service as any).pointsExpire.processExpiredBatches();
      ctx.logger.info(`[expire] users=${r.processedUsers} total=${r.totalExpired}`);
    } catch (err: any) {
      ctx.logger.error(`[expire] error: ${err.message}`, err);
    }
  }
}
