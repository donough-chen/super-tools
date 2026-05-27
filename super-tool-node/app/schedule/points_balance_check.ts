import { Subscription } from 'egg';

/**
 * 积分余额每小时巡检
 *  整点触发，采样最近 1 小时变动用户最多 100 个，发现差异落告警
 */
export default class PointsBalanceCheckSchedule extends Subscription {
  static get schedule() {
    return {
      cron: '0 0 * * * *',
      type: 'worker',
      immediate: false,
    };
  }

  async subscribe() {
    const { ctx } = this;
    try {
      const r = await (ctx.service as any).pointsReconcile.hourlyBalanceCheck();
      if (r.anomalies.length > 0) {
        ctx.logger.warn(`[balance_check] anomalies=${r.anomalies.length}`);
      } else {
        ctx.logger.info(`[balance_check] checked=${r.checked} ok`);
      }
    } catch (err: any) {
      ctx.logger.error(`[balance_check] error: ${err.message}`, err);
    }
  }
}
