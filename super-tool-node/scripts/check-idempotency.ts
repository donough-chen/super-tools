/* eslint-disable no-console */
/**
 * 一次性手测 idempotency 中间件 4 个核心场景
 *  对应 Plan A · Task A4 验收
 *  运行: npx ts-node --transpile-only scripts/check-idempotency.ts
 */
import idempotencyFactory from '../app/middleware/idempotency';

// 简易 mock app（最小 redis 实现）
function makeApp(redisOn = true) {
  const store = new Map<string, string>();
  return {
    redis: redisOn ? {
      get: async (k: string) => store.get(k) ?? null,
      setex: async (k: string, _ttl: number, v: string) => { store.set(k, v); return 'OK'; },
    } : null,
    _store: store,
  } as any;
}

function makeCtx(opts: { key?: string; userId?: number; body?: any; status?: number } = {}) {
  const headers: Record<string, string> = {};
  if (opts.key) headers['idempotency-key'] = opts.key;
  return {
    get: (k: string) => headers[k.toLowerCase()] || '',
    state: { user: opts.userId ? { id: opts.userId } : null },
    status: opts.status ?? 200,
    body: opts.body ?? { ok: true },
    logger: { warn: (...a: any[]) => console.log('[warn]', ...a) },
    set: (_k: string, _v: string) => { /* noop */ },
  } as any;
}

const VALID_KEY = '550e8400-e29b-41d4-a716-446655440000';

async function run() {
  const cases: { name: string; fn: () => Promise<void> }[] = [];

  // CASE 1: enforce=false（默认）+ 无 key → 放行
  cases.push({
    name: 'enforce=false 无 key 放行',
    fn: async () => {
      const app = makeApp();
      const idem = idempotencyFactory({}, app);
      const ctx = makeCtx({ userId: 1 });
      let nextCalled = false;
      await idem(ctx, async () => { nextCalled = true; });
      if (!nextCalled) throw new Error('expected next() to be called');
      if (ctx.status !== 200) throw new Error(`status should stay 200, got ${ctx.status}`);
    },
  });

  // CASE 2: enforce=true + 无 key → 400
  cases.push({
    name: 'enforce=true 无 key 返回 400',
    fn: async () => {
      const app = makeApp();
      const idem = idempotencyFactory({ enforce: true }, app);
      const ctx = makeCtx({ userId: 1 });
      let nextCalled = false;
      await idem(ctx, async () => { nextCalled = true; });
      if (nextCalled) throw new Error('next() should NOT be called');
      if (ctx.status !== 400) throw new Error(`status should be 400, got ${ctx.status}`);
      if (!String(ctx.body.message).includes('Idempotency-Key required')) {
        throw new Error(`message: ${ctx.body.message}`);
      }
    },
  });

  // CASE 3: enforce=true + 合法 key → 放行 + 缓存
  cases.push({
    name: 'enforce=true 带合法 key 放行并缓存',
    fn: async () => {
      const app = makeApp();
      const idem = idempotencyFactory({ enforce: true }, app);
      const ctx = makeCtx({ key: VALID_KEY, userId: 1, body: { ok: true, data: 'xyz' } });
      let nextCalled = false;
      await idem(ctx, async () => { nextCalled = true; });
      if (!nextCalled) throw new Error('next() should be called');
      const cached = app._store.get(`idem:1:${VALID_KEY}`);
      if (!cached) throw new Error('cache should be written');
      const parsed = JSON.parse(cached);
      if (parsed.body.data !== 'xyz') throw new Error('cached body wrong');
    },
  });

  // CASE 4: 重复请求 → 命中缓存（第二次不调 next，replay header）
  cases.push({
    name: '重复请求命中缓存 replay',
    fn: async () => {
      const app = makeApp();
      const idem = idempotencyFactory({}, app);

      // 第一次
      const ctx1 = makeCtx({ key: VALID_KEY, userId: 2, body: { v: 'first' } });
      await idem(ctx1, async () => { /* simulate handler */ });

      // 第二次：handler 不应再被调用
      const ctx2 = makeCtx({ key: VALID_KEY, userId: 2, body: { v: 'second' } });
      let secondHandlerCalled = false;
      let replayHeaderSet = false;
      ctx2.set = (k: string, _v: string) => {
        if (k === 'x-idempotent-replayed') replayHeaderSet = true;
      };
      await idem(ctx2, async () => { secondHandlerCalled = true; });

      if (secondHandlerCalled) throw new Error('handler should NOT run on replay');
      if (!replayHeaderSet) throw new Error('replay header should be set');
      if (ctx2.body.v !== 'first') throw new Error(`replay body wrong: ${JSON.stringify(ctx2.body)}`);
    },
  });

  // CASE 5: UUID 格式非法 → 400
  cases.push({
    name: '非 UUIDv4 key 返回 400',
    fn: async () => {
      const app = makeApp();
      const idem = idempotencyFactory({}, app);
      const ctx = makeCtx({ key: 'not-a-uuid', userId: 1 });
      await idem(ctx, async () => {});
      if (ctx.status !== 400) throw new Error(`status should be 400, got ${ctx.status}`);
      if (!String(ctx.body.message).includes('Invalid Idempotency-Key')) {
        throw new Error(`message: ${ctx.body.message}`);
      }
    },
  });

  // CASE 6: JSON.stringify 失败（循环引用）→ 静默跳过缓存（不抛错）
  cases.push({
    name: '循环引用 body 静默跳过缓存',
    fn: async () => {
      const app = makeApp();
      const idem = idempotencyFactory({}, app);
      const circ: any = { ok: true };
      circ.self = circ;
      const ctx = makeCtx({ key: VALID_KEY, userId: 3, body: circ });
      // 不应抛出
      await idem(ctx, async () => {});
      // 缓存里应没有这一条
      const cached = app._store.get(`idem:3:${VALID_KEY}`);
      if (cached) throw new Error('cache should NOT be written for non-serializable body');
    },
  });

  // CASE 7: Redis 不可用 → 直接放行
  cases.push({
    name: 'Redis 不可用降级放行',
    fn: async () => {
      const app = makeApp(false); // app.redis = null
      const idem = idempotencyFactory({}, app);
      const ctx = makeCtx({ key: VALID_KEY, userId: 4, body: { ok: true } });
      let nextCalled = false;
      await idem(ctx, async () => { nextCalled = true; });
      if (!nextCalled) throw new Error('next() should be called when redis is down');
    },
  });

  // CASE 8: 4xx 响应不进入缓存
  cases.push({
    name: '4xx 响应不缓存',
    fn: async () => {
      const app = makeApp();
      const idem = idempotencyFactory({}, app);
      const ctx = makeCtx({ key: VALID_KEY, userId: 5 });
      await idem(ctx, async () => {
        ctx.status = 400;
        ctx.body = { code: 400, message: 'bad' };
      });
      const cached = app._store.get(`idem:5:${VALID_KEY}`);
      if (cached) throw new Error('cache should NOT be written for 4xx');
    },
  });

  // 跑全部
  let pass = 0, fail = 0;
  for (const c of cases) {
    try {
      await c.fn();
      console.log(`✅ ${c.name}`);
      pass++;
    } catch (err: any) {
      console.log(`❌ ${c.name}: ${err.message}`);
      fail++;
    }
  }
  console.log(`\nResult: ${pass} passed, ${fail} failed (total ${cases.length})`);
  process.exit(fail === 0 ? 0 : 1);
}

run().catch(err => { console.error(err); process.exit(2); });
