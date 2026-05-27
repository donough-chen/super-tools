import { Subscription } from 'egg';

/**
 * 新手任务过期清理
 *  每日 03:00 触发，把超过 expire_at 的 pending 新手任务置为 expired
 */
export default class NewbieTaskExpireSchedule extends Subscription {
  static get schedule() {
    return {
      cron: '0 0 3 * * *',
      type: 'worker',
      immediate: false,
    };
  }

  async subscribe() {
    try {
      const updated = await (this.ctx.service as any).task.expireNewbieTasks();
      this.ctx.logger.info(`[newbie_expire] updated=${updated}`);
    } catch (err: any) {
      this.ctx.logger.error(`[newbie_expire] failed: ${err.message}`);
    }
  }
}
