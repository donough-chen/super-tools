import { Subscription } from 'egg';

export default class AlertCheck extends Subscription {
  static get schedule() {
    return {
      interval: '60s',
      type: 'worker' as const,
      immediate: false,
      disable: false,
    };
  }

  async subscribe() {
    try {
      await this.ctx.service.alert.checkAllRules();
    } catch (err) {
      this.ctx.logger.error('[Schedule:AlertCheck] 告警检测失败:', err);
    }
  }
}
