import { Subscription } from 'egg';

/**
 * 积分日终全量快照
 *  每日 23:55 执行
 */
export default class PointsDailySnapshotSchedule extends Subscription {
  static get schedule() {
    return {
      cron: '0 55 23 * * *',
      type: 'worker',
      immediate: false,
    };
  }

  async subscribe() {
    const { ctx } = this;
    try {
      const r = await (ctx.service as any).pointsReconcile.takeDailySnapshot();
      ctx.logger.info(`[snapshot] users=${r.users} anomalies=${r.anomalies}`);
    } catch (err: any) {
      ctx.logger.error(`[snapshot] error: ${err.message}`, err);
    }
  }
}
