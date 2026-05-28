export {};
/* eslint-disable @typescript-eslint/no-var-requires */
const { app } = require('egg-mock/bootstrap');
const assert = require('assert');

describe('Middleware - idempotency', () => {
  // 用 mockContext 模拟一次请求（不走完整 HTTP 栈，直接验证中间件行为）

  const VALID_KEY = '550e8400-e29b-41d4-a716-446655440000';
  const INVALID_KEY = 'not-a-uuid';

  function buildCtx(headerKey?: string, userId?: number) {
    const ctx: any = app.mockContext({
      headers: headerKey ? { 'idempotency-key': headerKey } : {},
    });
    if (userId !== undefined) {
      ctx.state.user = { id: userId };
    }
    return ctx;
  }

  it('未传 Idempotency-Key → 直接放行', async () => {
    const ctx = buildCtx(undefined, 100);
    const idem = (app.middleware as any).idempotency({ ttlHours: 1 }, app);
    let nextCalled = false;
    await idem(ctx, async () => { nextCalled = true; });
    assert.strictEqual(nextCalled, true);
  });

  it('未登录（无 ctx.state.user）→ 直接放行', async () => {
    const ctx = buildCtx(VALID_KEY, undefined);
    const idem = (app.middleware as any).idempotency({ ttlHours: 1 }, app);
    let nextCalled = false;
    await idem(ctx, async () => { nextCalled = true; });
    assert.strictEqual(nextCalled, true);
  });

  it('Idempotency-Key 不是 UUIDv4 → 返回 400', async () => {
    const ctx = buildCtx(INVALID_KEY, 100);
    const idem = (app.middleware as any).idempotency({ ttlHours: 1 }, app);
    let nextCalled = false;
    await idem(ctx, async () => { nextCalled = true; });
    assert.strictEqual(nextCalled, false);
    assert.strictEqual(ctx.status, 400);
    assert.strictEqual(ctx.body.code, 400);
    assert.ok(/Invalid/.test(ctx.body.message));
  });

  it('首次请求：写 Redis + 第二次请求命中缓存返回首次响应', async () => {
    if (!app.redis) {
      // 测试环境无 Redis 时跳过此测试
      return;
    }
    const userId = 7777;
    const k1 = '550e8400-e29b-41d4-a716-446655440011';
    // 清理可能残留
    await app.redis.del(`idem:${userId}:${k1}`);

    // 首次请求
    const ctx1 = buildCtx(k1, userId);
    const idem = (app.middleware as any).idempotency({ ttlHours: 1 }, app);
    await idem(ctx1, async () => {
      ctx1.status = 200;
      ctx1.body = { code: 200, message: 'ok', data: { points: 10, streak: 1 } };
    });
    assert.strictEqual(ctx1.status, 200);
    assert.strictEqual(ctx1.body.data.points, 10);
    assert.strictEqual(ctx1.response.get('x-idempotent-replayed'), '');

    // 第二次请求：直接返回首次响应（next 不应被调用）
    const ctx2 = buildCtx(k1, userId);
    let nextCalled = false;
    await idem(ctx2, async () => {
      nextCalled = true;
      ctx2.body = { code: 200, message: 'should not be returned' };
    });
    assert.strictEqual(nextCalled, false, 'next 不应执行');
    assert.strictEqual(ctx2.body.data.points, 10, '应返回首次响应');
    // 响应头通过 ctx.response.get 读取（ctx.get 取的是 request header）
    assert.strictEqual(ctx2.response.get('x-idempotent-replayed'), 'true');

    // 清理
    await app.redis.del(`idem:${userId}:${k1}`);
  });

  it('4xx 响应不缓存：第二次请求继续执行 next', async () => {
    if (!app.redis) return;
    const userId = 7778;
    const k = '550e8400-e29b-41d4-a716-446655440022';
    await app.redis.del(`idem:${userId}:${k}`);

    const idem = (app.middleware as any).idempotency({ ttlHours: 1 }, app);

    // 首次：返回 400
    const ctx1 = buildCtx(k, userId);
    await idem(ctx1, async () => {
      ctx1.status = 400;
      ctx1.body = { code: 400, message: 'bad request' };
    });

    // 第二次：next 应再次被调用（4xx 没缓存）
    const ctx2 = buildCtx(k, userId);
    let nextCalled = false;
    await idem(ctx2, async () => {
      nextCalled = true;
      ctx2.status = 200;
      ctx2.body = { code: 200, message: 'retry success' };
    });
    assert.strictEqual(nextCalled, true);

    await app.redis.del(`idem:${userId}:${k}`);
  });

  it('不同 userId 的相同 key 互不干扰', async () => {
    if (!app.redis) return;
    const k = '550e8400-e29b-41d4-a716-446655440033';
    const userA = 7779, userB = 7780;
    await app.redis.del(`idem:${userA}:${k}`);
    await app.redis.del(`idem:${userB}:${k}`);

    const idem = (app.middleware as any).idempotency({ ttlHours: 1 }, app);

    const ctxA = buildCtx(k, userA);
    await idem(ctxA, async () => {
      ctxA.status = 200;
      ctxA.body = { code: 200, data: { user: 'A' } };
    });

    // 用户 B 用相同 key → 不应命中 A 的缓存，next 必须执行
    const ctxB = buildCtx(k, userB);
    let nextCalled = false;
    await idem(ctxB, async () => {
      nextCalled = true;
      ctxB.status = 200;
      ctxB.body = { code: 200, data: { user: 'B' } };
    });
    assert.strictEqual(nextCalled, true);
    assert.strictEqual(ctxB.body.data.user, 'B');

    await app.redis.del(`idem:${userA}:${k}`);
    await app.redis.del(`idem:${userB}:${k}`);
  });
});
