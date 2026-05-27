import { Context } from 'egg';

interface IdempotencyOptions {
  ttlHours?: number;
}

/**
 * Idempotency-Key 中间件
 *  设计依据: docs/superpowers/plans/2026-05-26-积分成长体系MVP实施计划-v2.md §Task 14
 *           docs/analysis/积分与成长体系深度评估报告.md §5.3 幂等防双花
 *
 *  使用方式：
 *    在 router.ts 中按需挂载到积分写入类路由：
 *      const idem = (app.middleware as any).idempotency({ ttlHours: 24 }, app);
 *      router.post('/api/sign', auth, idem, controller.sign.create);
 *
 *  约定：
 *    - 客户端在 POST 请求头带 `Idempotency-Key: <UUIDv4>`
 *    - 服务端 Redis 缓存 `idem:{userId}:{key}` 24 小时
 *    - 同 Key 第二次请求直接返回首次响应，附响应头 `x-idempotent-replayed: true`
 *    - 仅 2xx 响应进入缓存（4xx/5xx 不缓存，允许重试）
 *    - 没有传 Idempotency-Key 或 Redis 不可用时直接放行（不强制）
 */
export default (options: IdempotencyOptions, app: any) => {
  const ttl = (options?.ttlHours || 24) * 3600;

  return async (ctx: Context, next: () => Promise<any>) => {
    const key = ctx.get('idempotency-key');
    const userId = (ctx.state.user as any)?.id;

    // 没有 key 或非登录请求 → 跳过
    if (!key || !userId) return await next();

    // UUIDv4 格式校验
    const isUuidV4 =
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(key);
    if (!isUuidV4) {
      ctx.status = 400;
      ctx.body = {
        code: 400,
        message: 'Invalid Idempotency-Key (expect UUID v4)',
        timestamp: Date.now(),
      };
      return;
    }

    // Redis 不可用时降级放行（不阻塞业务）
    if (!app.redis) return await next();

    const redisKey = `idem:${userId}:${key}`;

    // 1) 命中缓存 → 直接返回首次响应
    let cached: string | null = null;
    try {
      cached = await app.redis.get(redisKey);
    } catch (err: any) {
      ctx.logger.warn(`[idempotency] redis get err: ${err.message}`);
    }
    if (cached) {
      try {
        const obj = JSON.parse(cached);
        ctx.status = obj.status || 200;
        ctx.body = obj.body;
        ctx.set('x-idempotent-replayed', 'true');
      } catch {
        ctx.logger.warn('[idempotency] cached payload parse fail, bypass');
      }
      return;
    }

    // 2) 首次请求 → 执行 + 写缓存
    await next();

    // 仅 2xx 缓存（4xx/5xx 让客户端重试）
    if (ctx.status >= 200 && ctx.status < 300) {
      try {
        await app.redis.setex(
          redisKey,
          ttl,
          JSON.stringify({ status: ctx.status, body: ctx.body }),
        );
      } catch (err: any) {
        ctx.logger.warn(`[idempotency] redis setex err: ${err.message}`);
      }
    }
  };
};
