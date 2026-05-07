import { Context } from 'egg';

interface RateLimitOptions {
  max?: number;
  window?: number;
  message?: string;
}

export default (options: RateLimitOptions, app: any) => {
  const {
    max = 100,
    window: windowSec = 60,
    message = '请求过于频繁，请稍后再试',
  } = options || {};

  return async (ctx: Context, next: () => Promise<void>) => {
    // Redis 不可用时直接放行
    if (!app.redis) {
      return await next();
    }

    const ip = ctx.ip;
    const rateLimitPrefix =
      (app.config as any).appConfig?.rateLimitPrefix || 'rate:limit:';
    const key = `${rateLimitPrefix}${ip}:${ctx.path}`;

    try {
      const current = await app.redis.incr(key);

      if (current === 1) {
        await app.redis.expire(key, windowSec);
      }

      // 设置响应头
      ctx.set('X-RateLimit-Limit', String(max));
      ctx.set(
        'X-RateLimit-Remaining',
        String(Math.max(0, max - current)),
      );

      if (current > max) {
        ctx.throw(429, message);
      }
    } catch (err: any) {
      // Redis 不可用时放行请求
      if (err.status === 429) {
        throw err;
      }
      ctx.logger.warn('[RateLimit] Redis error, skipping rate limit:', err.message);
    }

    await next();
  };
};
