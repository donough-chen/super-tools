import { Subscription } from 'egg';

/**
 * 积分过期多渠道分时提醒
 *  每日 10:00 执行（用户活跃时段）
 *  T-30 / T-7 / T-0 三阶段；通过 PointsExpiryNotice 唯一索引保幂等
 */
export default class PointsExpireRemindSchedule extends Subscription {
  static get schedule() {
    return {
      cron: '0 0 10 * * *',
      type: 'worker',
      immediate: false,
    };
  }

  async subscribe() {
    const { ctx } = this;
    try {
      const r = await (ctx.service as any).pointsExpire.sendExpireReminders();
      ctx.logger.info(`[expire_remind] sent=${r.sent}`);
    } catch (err: any) {
      ctx.logger.error(`[expire_remind] error: ${err.message}`, err);
    }
  }
}
