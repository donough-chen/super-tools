import { Subscription } from 'egg';

export default class CleanExpiredToken extends Subscription {
  static get schedule() {
    return {
      interval: '1h',
      type: 'worker' as const,
      immediate: false,
      disable: false,
    };
  }

  async subscribe() {
    this.logger.info('[Schedule] 开始清理过期Token黑名单...');

    try {
      const appConfig = (this.app.config as any).appConfig;
      const pattern = `${appConfig.tokenBlacklistPrefix}*`;
      const keys = await this.app.redis.keys(pattern);

      let cleanedCount = 0;
      for (const key of keys) {
        const ttl = await this.app.redis.ttl(key);
        if (ttl <= 0) {
          await this.app.redis.del(key);
          cleanedCount++;
        }
      }

      this.logger.info(
        `[Schedule] 清理完成，共清理 ${cleanedCount} 个过期Token`,
      );
    } catch (err) {
      this.logger.error('[Schedule] 清理Token失败', err);
    }
  }
}
