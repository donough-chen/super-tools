import { Context } from 'egg';

interface IdempotencyOptions {
  ttlHours?: number;
  /**
   * 强制要求带 Idempotency-Key
   *  - false（默认）：未带 key 放行（向后兼容旧客户端）
   *  - true：未带 key 返回 400（用于 sign / claim / exchange 等扣资源接口）
   */
  enforce?: boolean;
}

/**
 * Idempotency-Key 中间件
 *  设计依据: docs/superpowers/plans/2026-05-26-积分成长体系MVP实施计划-v2.md §Task 14
 *           docs/analysis/积分与成长体系深度评估报告.md §5.3 幂等防双花
 *           docs/superpowers/specs/2026-05-27-积分成长体系后端优化设计文档.md §2.9-#27/#28
 *
 *  使用方式：
 *    在 router.ts 中按需挂载到积分写入类路由：
 *      const idem = (app.middleware as any).idempotency({ ttlHours: 24, enforce: true }, app);
 *      router.post('/api/sign', auth, idem, controller.sign.create);
 *
 *  约定：
 *    - 客户端在 POST 请求头带 `Idempotency-Key: <UUIDv4>`
 *    - 服务端 Redis 缓存 `idem:{userId}:{key}` 24 小时
 *    - 同 Key 第二次请求直接返回首次响应，附响应头 `x-idempotent-replayed: true`
 *    - 仅 2xx 响应进入缓存（4xx/5xx 不缓存，允许重试）
 *    - enforce=true 时未带 key 返回 400（强制带 key，否则放行）
 *    - JSON.stringify 失败（如循环引用 / Buffer / Stream）静默跳过缓存（不阻塞业务）
 *    - Redis 不可用时降级放行（不强制）
 */
export default (options: IdempotencyOptions, app: any) => {
  const ttl = (options?.ttlHours || 24) * 3600;
  const enforce = options?.enforce === true;

  return async (ctx: Context, next: () => Promise<any>) => {
    const key = ctx.get('idempotency-key');
    const userId = (ctx.state.user as any)?.id;

    // 1) enforce 模式且无 key → 400（在 userId 检查之前，避免未登录请求绕过）
    if (enforce && !key) {
      ctx.status = 400;
      ctx.body = {
        code: 400,
        message: 'Idempotency-Key required (UUID v4 in request header)',
        timestamp: Date.now(),
      };
      return;
    }

    // 2) 没有 key 或非登录请求 → 跳过（向后兼容）
    if (!key || !userId) return await next();

    // 3) UUIDv4 格式校验
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

    // 4) Redis 不可用时降级放行（不阻塞业务）
    if (!app.redis) return await next();

    const redisKey = `idem:${userId}:${key}`;

    // 5) 命中缓存 → 直接返回首次响应
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

    // 6) 首次请求 → 执行 + 写缓存
    await next();

    // 7) 仅 2xx 缓存（4xx/5xx 让客户端重试）
    if (ctx.status >= 200 && ctx.status < 300) {
      let payload: string | null = null;
      try {
        payload = JSON.stringify({ status: ctx.status, body: ctx.body });
      } catch (err: any) {
        // 循环引用 / Buffer / Stream 等无法序列化 → 静默跳过缓存
        ctx.logger.warn(`[idempotency] body not serializable, skip cache: ${err.message}`);
        return;
      }
      try {
        await app.redis.setex(redisKey, ttl, payload);
      } catch (err: any) {
        ctx.logger.warn(`[idempotency] redis setex err: ${err.message}`);
      }
    }
  };
};
