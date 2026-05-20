# P2.1-04：notification-rate-limit service + Lua + 测试（Task 4）

> 父计划：[2026-05-23-notification-p2-1-rate-quiet-mail.md](./2026-05-23-notification-p2-1-rate-quiet-mail.md)
> 前置：Task 2（[`p2-1-02-migration.md`](./p2-1-02-migration.md)）

---

## Step 1: 创建 Lua 脚本常量 `app/lib/rateLimitLua.ts`

- [ ] 内容：

```typescript
/**
 * 频控 Lua 原子计数器。
 *
 * KEYS[1]: counter key
 * ARGV[1]: window seconds
 * ARGV[2]: max count
 * Returns:
 *   {1, count}   = within limit, count after increment
 *   {0, count}   = limit exceeded, current count returned (NOT incremented further)
 */
export const RATE_LIMIT_LUA = `
local cur = redis.call('INCR', KEYS[1])
if cur == 1 then
  redis.call('EXPIRE', KEYS[1], tonumber(ARGV[1]))
end
if cur > tonumber(ARGV[2]) then
  return {0, cur}
end
return {1, cur}
`;
```

---

## Step 2: 创建测试文件 `test/notification/service/notification-rate-limit.test.ts`

- [ ] 12 用例（先 fail 再实现）：

```typescript
import { app, assert } from 'egg-mock/bootstrap';

describe('service/notification-rate-limit', () => {
  let ctx: any;
  const userId = 9001, typeId = 7001;

  beforeEach(async () => {
    ctx = app.mockContext();
    const redis: any = app.redis;
    const keys = await redis.keys('notif:rl:*');
    if (keys.length) await redis.del(...keys);
    await ctx.model.NotificationRateLimitConfig.destroy({
      where: { description: { [app.Sequelize.Op.like]: 'TEST_%' } }, force: true,
    });
    (ctx.service.notificationRateLimit as any).invalidateCache();
  });

  it('user_type 限制：5 秒内最多 2 次，第 3 次拒绝', async () => {
    await ctx.model.NotificationRateLimitConfig.create({
      scope: 'user_type', typeId, channel: null,
      windowSeconds: 5, maxCount: 2, enabled: 1, description: 'TEST_user_type_5s2',
    });
    (ctx.service.notificationRateLimit as any).invalidateCache();
    const a = await ctx.service.notificationRateLimit.check({ userId, typeId, channel: 'inApp' });
    const b = await ctx.service.notificationRateLimit.check({ userId, typeId, channel: 'inApp' });
    const c = await ctx.service.notificationRateLimit.check({ userId, typeId, channel: 'inApp' });
    assert.equal(a.allowed, true);
    assert.equal(b.allowed, true);
    assert.equal(c.allowed, false);
    assert.equal(c.hitRule.scope, 'user_type');
  });

  it('窗口过期后计数重置', async () => {
    await ctx.model.NotificationRateLimitConfig.create({
      scope: 'user_global', typeId: null, channel: null,
      windowSeconds: 1, maxCount: 1, enabled: 1, description: 'TEST_user_global_1s1',
    });
    (ctx.service.notificationRateLimit as any).invalidateCache();
    const a = await ctx.service.notificationRateLimit.check({ userId, typeId, channel: 'inApp' });
    const b = await ctx.service.notificationRateLimit.check({ userId, typeId, channel: 'inApp' });
    assert.equal(a.allowed, true);
    assert.equal(b.allowed, false);
    await new Promise((r) => setTimeout(r, 1100));
    const c = await ctx.service.notificationRateLimit.check({ userId, typeId, channel: 'inApp' });
    assert.equal(c.allowed, true);
  });

  it('user_global 限制独立于 type', async () => {
    await ctx.model.NotificationRateLimitConfig.create({
      scope: 'user_global', typeId: null, channel: null,
      windowSeconds: 60, maxCount: 1, enabled: 1, description: 'TEST_global_1',
    });
    (ctx.service.notificationRateLimit as any).invalidateCache();
    const a = await ctx.service.notificationRateLimit.check({ userId, typeId: 1, channel: 'inApp' });
    const b = await ctx.service.notificationRateLimit.check({ userId, typeId: 2, channel: 'inApp' });
    assert.equal(a.allowed, true);
    assert.equal(b.allowed, false);
  });

  it('global 限制独立于用户', async () => {
    await ctx.model.NotificationRateLimitConfig.create({
      scope: 'global', typeId: null, channel: null,
      windowSeconds: 60, maxCount: 1, enabled: 1, description: 'TEST_g_1',
    });
    (ctx.service.notificationRateLimit as any).invalidateCache();
    const a = await ctx.service.notificationRateLimit.check({ userId: 100, typeId, channel: 'inApp' });
    const b = await ctx.service.notificationRateLimit.check({ userId: 200, typeId, channel: 'inApp' });
    assert.equal(a.allowed, true);
    assert.equal(b.allowed, false);
  });

  it('channel 限制：仅命中匹配的 channel', async () => {
    await ctx.model.NotificationRateLimitConfig.create({
      scope: 'channel', typeId: null, channel: 'email',
      windowSeconds: 60, maxCount: 1, enabled: 1, description: 'TEST_chan_email_1',
    });
    (ctx.service.notificationRateLimit as any).invalidateCache();
    const a = await ctx.service.notificationRateLimit.check({ userId, typeId, channel: 'email' });
    const b = await ctx.service.notificationRateLimit.check({ userId, typeId, channel: 'inApp' });
    const c = await ctx.service.notificationRateLimit.check({ userId, typeId, channel: 'email' });
    assert.equal(a.allowed, true);
    assert.equal(b.allowed, true);
    assert.equal(c.allowed, false);
  });

  it('多规则同时存在 → 任一拒绝即拒绝', async () => {
    await ctx.model.NotificationRateLimitConfig.bulkCreate([
      { scope: 'user_type', typeId, channel: null,
        windowSeconds: 60, maxCount: 100, enabled: 1, description: 'TEST_high_max' },
      { scope: 'user_global', typeId: null, channel: null,
        windowSeconds: 60, maxCount: 1, enabled: 1, description: 'TEST_low_global' },
    ]);
    (ctx.service.notificationRateLimit as any).invalidateCache();
    const a = await ctx.service.notificationRateLimit.check({ userId, typeId, channel: 'inApp' });
    const b = await ctx.service.notificationRateLimit.check({ userId, typeId, channel: 'inApp' });
    assert.equal(a.allowed, true);
    assert.equal(b.allowed, false);
    assert.equal(b.hitRule.scope, 'user_global');
  });

  it('enabled=0 的规则被忽略', async () => {
    await ctx.model.NotificationRateLimitConfig.create({
      scope: 'user_global', typeId: null, channel: null,
      windowSeconds: 60, maxCount: 0, enabled: 0, description: 'TEST_disabled',
    });
    (ctx.service.notificationRateLimit as any).invalidateCache();
    const a = await ctx.service.notificationRateLimit.check({ userId, typeId, channel: 'inApp' });
    assert.equal(a.allowed, true);
  });

  it('peek 不消耗计数', async () => {
    await ctx.model.NotificationRateLimitConfig.create({
      scope: 'user_global', typeId: null, channel: null,
      windowSeconds: 60, maxCount: 1, enabled: 1, description: 'TEST_peek',
    });
    (ctx.service.notificationRateLimit as any).invalidateCache();
    const p1 = await ctx.service.notificationRateLimit.peek({ userId, typeId, channel: 'inApp' });
    const p2 = await ctx.service.notificationRateLimit.peek({ userId, typeId, channel: 'inApp' });
    assert.equal(p1.allowed, true);
    assert.equal(p2.allowed, true); // peek 不消费
  });

  it('refundOne：消费失败时还原计数', async () => {
    await ctx.model.NotificationRateLimitConfig.create({
      scope: 'user_global', typeId: null, channel: null,
      windowSeconds: 60, maxCount: 1, enabled: 1, description: 'TEST_refund',
    });
    (ctx.service.notificationRateLimit as any).invalidateCache();
    const a = await ctx.service.notificationRateLimit.check({ userId, typeId, channel: 'inApp' });
    assert.equal(a.allowed, true);
    await ctx.service.notificationRateLimit.refundOne({ userId, typeId, channel: 'inApp' });
    const b = await ctx.service.notificationRateLimit.check({ userId, typeId, channel: 'inApp' });
    assert.equal(b.allowed, true);
  });

  it('listActiveRules 5 分钟内复用缓存', async () => {
    const a = await (ctx.service.notificationRateLimit as any).listActiveRules();
    const b = await (ctx.service.notificationRateLimit as any).listActiveRules();
    assert.equal(a === b, true);
  });

  it('user_type 不带 channel：同 user 不同 channel 共享计数', async () => {
    await ctx.model.NotificationRateLimitConfig.create({
      scope: 'user_type', typeId, channel: null,
      windowSeconds: 60, maxCount: 1, enabled: 1, description: 'TEST_ut_x',
    });
    (ctx.service.notificationRateLimit as any).invalidateCache();
    const a = await ctx.service.notificationRateLimit.check({ userId, typeId, channel: 'email' });
    const b = await ctx.service.notificationRateLimit.check({ userId, typeId, channel: 'inApp' });
    assert.equal(a.allowed, true);
    assert.equal(b.allowed, false);
  });

  it('Lua 脚本 NOSCRIPT 时自动 EVAL 重试', async () => {
    const redis: any = app.redis;
    await redis.script('FLUSH');
    await ctx.model.NotificationRateLimitConfig.create({
      scope: 'user_global', typeId: null, channel: null,
      windowSeconds: 60, maxCount: 5, enabled: 1, description: 'TEST_noscript',
    });
    (ctx.service.notificationRateLimit as any).invalidateCache();
    (ctx.service.notificationRateLimit as any).constructor._luaSha = null;
    const a = await ctx.service.notificationRateLimit.check({ userId, typeId, channel: 'inApp' });
    assert.equal(a.allowed, true);
  });
});
```

---

## Step 3: 创建实现 `app/service/notification-rate-limit.ts`

- [ ] 内容：

```typescript
import { Service } from 'egg';
import { RATE_LIMIT_LUA } from '../lib/rateLimitLua';

interface RateRule {
  id: number;
  scope: 'user_type' | 'user_global' | 'global' | 'channel';
  typeId: number | null;
  channel: 'inApp' | 'email' | 'sms' | null;
  windowSeconds: number;
  maxCount: number;
}

interface CheckInput {
  userId: number;
  typeId: number;
  channel: 'inApp' | 'email' | 'sms';
}

interface CheckResult {
  allowed: boolean;
  hitRule?: RateRule;
}

const CACHE_TTL_MS = 5 * 60 * 1000;

export default class NotificationRateLimitService extends Service {

  private static _ruleCache: { at: number; rules: RateRule[] } | null = null;
  private static _luaSha: string | null = null;

  async listActiveRules(): Promise<RateRule[]> {
    const cache = NotificationRateLimitService._ruleCache;
    if (cache && Date.now() - cache.at < CACHE_TTL_MS) return cache.rules;
    const rows = await this.ctx.model.NotificationRateLimitConfig.findAll({ where: { enabled: 1 } });
    const rules: RateRule[] = rows.map((r: any) => ({
      id: r.id, scope: r.scope, typeId: r.typeId,
      channel: r.channel, windowSeconds: r.windowSeconds, maxCount: r.maxCount,
    }));
    NotificationRateLimitService._ruleCache = { at: Date.now(), rules };
    return rules;
  }

  /** admin 修改规则后调用，使新规则即刻生效 */
  invalidateCache() {
    NotificationRateLimitService._ruleCache = null;
  }

  async check(input: CheckInput): Promise<CheckResult> {
    return this._evaluate(input, true);
  }

  async peek(input: CheckInput): Promise<CheckResult> {
    return this._evaluate(input, false);
  }

  async refundOne(input: CheckInput): Promise<void> {
    const redis: any = this.app.redis;
    const rules = await this._matchRules(input);
    for (const r of rules) {
      await redis.decr(this._buildKey(r, input));
    }
  }

  private async _evaluate(input: CheckInput, consume: boolean): Promise<CheckResult> {
    const redis: any = this.app.redis;
    const rules = await this._matchRules(input);
    if (rules.length === 0) return { allowed: true };

    if (!consume) {
      for (const r of rules) {
        const v = await redis.get(this._buildKey(r, input));
        const cur = v ? Number(v) : 0;
        if (cur >= r.maxCount) return { allowed: false, hitRule: r };
      }
      return { allowed: true };
    }

    for (const r of rules) {
      const key = this._buildKey(r, input);
      const [allowed] = await this._runLua(key, r.windowSeconds, r.maxCount);
      if (!allowed) {
        await this._rollbackPriorIncrs(rules, r, input);
        return { allowed: false, hitRule: r };
      }
    }
    return { allowed: true };
  }

  private async _runLua(key: string, win: number, max: number): Promise<[number, number]> {
    const redis: any = this.app.redis;
    try {
      if (!NotificationRateLimitService._luaSha) {
        NotificationRateLimitService._luaSha = await redis.script('LOAD', RATE_LIMIT_LUA);
      }
      const r = await redis.evalsha(
        NotificationRateLimitService._luaSha, 1, key, String(win), String(max),
      );
      return [Number(r[0]), Number(r[1])];
    } catch (e: any) {
      if (e.message?.includes('NOSCRIPT')) {
        const r = await redis.eval(RATE_LIMIT_LUA, 1, key, String(win), String(max));
        NotificationRateLimitService._luaSha = await redis.script('LOAD', RATE_LIMIT_LUA);
        return [Number(r[0]), Number(r[1])];
      }
      throw e;
    }
  }

  private async _rollbackPriorIncrs(rules: RateRule[], hit: RateRule, input: CheckInput): Promise<void> {
    const redis: any = this.app.redis;
    for (const r of rules) {
      if (r.id === hit.id) break;
      await redis.decr(this._buildKey(r, input));
    }
  }

  private async _matchRules(input: CheckInput): Promise<RateRule[]> {
    const all = await this.listActiveRules();
    return all.filter((r) => {
      if (r.scope === 'global') return true;
      if (r.scope === 'user_global') return true;
      if (r.scope === 'user_type') return r.typeId === input.typeId;
      if (r.scope === 'channel') return r.channel === input.channel;
      return false;
    });
  }

  private _buildKey(rule: RateRule, input: CheckInput): string {
    const prefix = this.app.config.notification.rateLimit.redisKeyPrefix;
    const win = rule.windowSeconds;
    switch (rule.scope) {
      case 'global':       return `${prefix}global:${win}`;
      case 'user_global':  return `${prefix}user:${input.userId}:global:${win}`;
      case 'user_type':    return `${prefix}user:${input.userId}:type:${rule.typeId}:${win}`;
      case 'channel':      return `${prefix}channel:${rule.channel}:${win}`;
      default:             return `${prefix}unknown:${rule.id}:${win}`;
    }
  }
}
```

---

## Step 4: 运行测试验证全 PASS

```bash
npm test -- --testPathPattern=notification-rate-limit
```

预期：12/12 PASS。

---

## Step 5: Commit

```bash
git add super-tool-node/app/lib/rateLimitLua.ts super-tool-node/app/service/notification-rate-limit.ts super-tool-node/test/notification/service/notification-rate-limit.test.ts
git commit -m "feat(notification): add rate-limit service with redis lua atomic counter (4 scopes)

- Atomic INCR + EXPIRE via Lua script (NOSCRIPT auto retry)
- 4 scopes: user_type / user_global / global / channel
- Multi-rule eval with rollback on hit (avoid double-counting)
- 5min in-process rule cache + invalidateCache() for admin changes
- 12 unit tests covering all scopes, expiry, peek, refund, cache, NOSCRIPT

Refs: docs/analysis/通知推送系统模块设计需求文档.md (V2 §7.3)
Plan: docs/superpowers/plans/2026-05-23-notification-p2-1-rate-quiet-mail.md (Task 4)"
```

---

## Verification Checklist

- [ ] `rateLimitLua.ts` 存在
- [ ] service 含 `check / peek / refundOne / listActiveRules / invalidateCache` 5 个方法
- [ ] 12 用例全 PASS
- [ ] commit 已提交

完成后进入 [`p2-1-05-mail-service.md`](./p2-1-05-mail-service.md)。
