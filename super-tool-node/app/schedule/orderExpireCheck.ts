import { Subscription } from 'egg';

/**
 * 订单超时清理：每 5 分钟扫描 status=0 且 expireAt < now 的订单 → 置为 status=2（超时）。
 * 实现委托 service.order.cleanExpired()。
 */
export default class OrderExpireCheck extends Subscription {
  static get schedule() {
    return {
      interval: '5m',
      type: 'worker' as const,
      immediate: false,
      disable: false,
    };
  }

  async subscribe() {
    try {
      const affected = await this.ctx.service.order.cleanExpired();
      if (affected > 0) {
        this.ctx.logger.info(`[Schedule:OrderExpireCheck] 自动过期订单数: ${affected}`);
      }
    } catch (err) {
      this.ctx.logger.error('[Schedule:OrderExpireCheck] 失败:', err);
    }
  }
}
