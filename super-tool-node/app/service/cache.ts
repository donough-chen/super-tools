import BaseService from './base';

export default class CacheService extends BaseService {
  /**
   * 分布式锁
   */
  async acquireLock(key: string, ttl: number = 30): Promise<string | null> {
    const lockKey = `lock:${key}`;
    const lockValue = `${Date.now()}_${Math.random()}`;

    const result = await this.app.redis.set(
      lockKey,
      lockValue,
      'EX',
      ttl,
      'NX',
    );

    return result === 'OK' ? lockValue : null;
  }

  /**
   * 释放分布式锁
   */
  async releaseLock(key: string, lockValue: string): Promise<boolean> {
    const lockKey = `lock:${key}`;
    const script = `
      if redis.call("get", KEYS[1]) == ARGV[1] then
        return redis.call("del", KEYS[1])
      else
        return 0
      end
    `;

    const result = await (this.app.redis as any).eval(
      script,
      1,
      lockKey,
      lockValue,
    );
    return result === 1;
  }

  /**
   * 计数器（用于统计、限流）
   */
  async increment(key: string, ttl?: number): Promise<number> {
    const count = await this.app.redis.incr(key);
    if (count === 1 && ttl) {
      await this.app.redis.expire(key, ttl);
    }
    return count;
  }

  /**
   * 缓存用户权限
   */
  async cacheUserPermissions(
    userId: number,
    permissions: string[],
  ): Promise<void> {
    const key = `user:permissions:${userId}`;
    await this.app.redis.setex(key, 3600, JSON.stringify(permissions));
  }

  /**
   * 获取用户权限缓存
   */
  async getUserPermissions(userId: number): Promise<string[] | null> {
    const key = `user:permissions:${userId}`;
    const cached = await this.app.redis.get(key);
    return cached ? JSON.parse(cached) : null;
  }
}
