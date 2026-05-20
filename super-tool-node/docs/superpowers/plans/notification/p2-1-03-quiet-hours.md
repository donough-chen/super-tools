# P2.1-03：notification-quiet-hours service + 测试（Task 3）

> 父计划：[2026-05-23-notification-p2-1-rate-quiet-mail.md](./2026-05-23-notification-p2-1-rate-quiet-mail.md)
> 前置：Task 2（[`p2-1-02-migration.md`](./p2-1-02-migration.md)）

---

## Step 1: 创建测试文件 `test/notification/service/notification-quiet-hours.test.ts`

- [ ] 写测试（8 用例，TDD）：

```typescript
import { app, assert } from 'egg-mock/bootstrap';

describe('service/notification-quiet-hours', () => {
  let ctx: any;
  beforeEach(async () => {
    ctx = app.mockContext();
    await ctx.model.NotificationUserQuietHours.destroy({ where: { userId: 7001 }, force: true });
  });

  it('未设置静默 → isInQuiet=false', async () => {
    const r = await ctx.service.notificationQuietHours.isInQuiet({
      userId: 7001, at: new Date('2026-05-23T03:00:00+08:00'),
    });
    assert.equal(r.inQuiet, false);
  });

  it('22:00-08:00 跨夜规则，凌晨 3 点 → inQuiet=true', async () => {
    await ctx.model.NotificationUserQuietHours.create({
      userId: 7001, startAt: '22:00', endAt: '08:00',
      timezone: 'Asia/Shanghai', enabled: 1,
    });
    const r = await ctx.service.notificationQuietHours.isInQuiet({
      userId: 7001, at: new Date('2026-05-23T03:00:00+08:00'),
    });
    assert.equal(r.inQuiet, true);
  });

  it('22:00-08:00 跨夜规则，下午 14 点 → inQuiet=false', async () => {
    await ctx.model.NotificationUserQuietHours.create({
      userId: 7001, startAt: '22:00', endAt: '08:00',
      timezone: 'Asia/Shanghai', enabled: 1,
    });
    const r = await ctx.service.notificationQuietHours.isInQuiet({
      userId: 7001, at: new Date('2026-05-23T14:00:00+08:00'),
    });
    assert.equal(r.inQuiet, false);
  });

  it('13:00-15:00 当日规则，14 点 → inQuiet=true', async () => {
    await ctx.model.NotificationUserQuietHours.create({
      userId: 7001, startAt: '13:00', endAt: '15:00',
      timezone: 'Asia/Shanghai', enabled: 1,
    });
    const r = await ctx.service.notificationQuietHours.isInQuiet({
      userId: 7001, at: new Date('2026-05-23T14:00:00+08:00'),
    });
    assert.equal(r.inQuiet, true);
  });

  it('用户时区 America/New_York，UTC 06:00 = 当地 02:00，22-08 → inQuiet=true', async () => {
    await ctx.model.NotificationUserQuietHours.create({
      userId: 7001, startAt: '22:00', endAt: '08:00',
      timezone: 'America/New_York', enabled: 1,
    });
    const r = await ctx.service.notificationQuietHours.isInQuiet({
      userId: 7001, at: new Date('2026-05-23T06:00:00Z'),
    });
    assert.equal(r.inQuiet, true);
  });

  it('enabled=0 → 即使在窗口内也 false', async () => {
    await ctx.model.NotificationUserQuietHours.create({
      userId: 7001, startAt: '22:00', endAt: '08:00',
      timezone: 'Asia/Shanghai', enabled: 0,
    });
    const r = await ctx.service.notificationQuietHours.isInQuiet({
      userId: 7001, at: new Date('2026-05-23T03:00:00+08:00'),
    });
    assert.equal(r.inQuiet, false);
  });

  it('shouldSkipForType: type.quietHourPolicy=bypass → false（不跳过）', async () => {
    const skip = await ctx.service.notificationQuietHours.shouldSkipForType({
      userId: 7001,
      typeQuietPolicy: 'bypass',
      channel: 'inApp',
      at: new Date('2026-05-23T03:00:00+08:00'),
    });
    assert.equal(skip, false);
  });

  it('shouldSkipForType: type=relax + channel=inApp → true；channel=email → false', async () => {
    await ctx.model.NotificationUserQuietHours.create({
      userId: 7001, startAt: '22:00', endAt: '08:00',
      timezone: 'Asia/Shanghai', enabled: 1,
    });
    const at = new Date('2026-05-23T03:00:00+08:00');
    const skipInApp = await ctx.service.notificationQuietHours.shouldSkipForType({
      userId: 7001, typeQuietPolicy: 'relax', channel: 'inApp', at,
    });
    const skipEmail = await ctx.service.notificationQuietHours.shouldSkipForType({
      userId: 7001, typeQuietPolicy: 'relax', channel: 'email', at,
    });
    assert.equal(skipInApp, true);
    assert.equal(skipEmail, false);
  });
});
```

---

## Step 2: 运行测试验证全部失败

```bash
cd super-tool-node
npm test -- --testPathPattern=notification-quiet-hours
```

预期：8 用例全部 FAIL（service 尚未实现）。

---

## Step 3: 创建实现 `app/service/notification-quiet-hours.ts`

- [ ] 内容：

```typescript
import { Service } from 'egg';

/** "HH:mm" → 分钟数 */
function parseHHmm(s: string): number {
  const [h, m] = s.split(':').map(Number);
  return h * 60 + m;
}

/** Date 在指定 IANA 时区下的 (hour, minute) → 分钟数 */
function getTzMinutes(date: Date, timezone: string): number {
  const fmt = new Intl.DateTimeFormat('en-US', {
    hour: '2-digit', minute: '2-digit', hour12: false, timeZone: timezone,
  });
  const parts = fmt.formatToParts(date);
  const hh = Number(parts.find((p) => p.type === 'hour')!.value);
  const mm = Number(parts.find((p) => p.type === 'minute')!.value);
  return (hh % 24) * 60 + mm;
}

export default class NotificationQuietHoursService extends Service {

  async isInQuiet(input: { userId: number; at?: Date }): Promise<{ inQuiet: boolean; rule?: any }> {
    const at = input.at ?? new Date();
    const rule = await this.ctx.model.NotificationUserQuietHours.findOne({
      where: { userId: input.userId, enabled: 1 },
    });
    if (!rule) return { inQuiet: false };

    const tz = rule.timezone || this.app.config.notification.quietHours.defaultTimezone;
    const nowMin = getTzMinutes(at, tz);
    const startMin = parseHHmm(rule.startAt);
    const endMin = parseHHmm(rule.endAt);

    let inQuiet: boolean;
    if (startMin === endMin) {
      inQuiet = false; // 同时刻视为关闭
    } else if (startMin < endMin) {
      inQuiet = nowMin >= startMin && nowMin < endMin; // 当日窗口
    } else {
      inQuiet = nowMin >= startMin || nowMin < endMin; // 跨夜窗口
    }
    return { inQuiet, rule };
  }

  /** 综合 type 策略后判断"该不该跳过本次发送" */
  async shouldSkipForType(input: {
    userId: number;
    typeQuietPolicy: 'respect' | 'bypass' | 'relax';
    channel: 'inApp' | 'email' | 'sms';
    at?: Date;
  }): Promise<boolean> {
    if (input.typeQuietPolicy === 'bypass') return false;
    const { inQuiet } = await this.isInQuiet({ userId: input.userId, at: input.at });
    if (!inQuiet) return false;
    if (input.typeQuietPolicy === 'relax') {
      // relax：仅 inApp 受静默约束（不打扰），email/sms 仍然送达
      return input.channel === 'inApp';
    }
    return true; // respect
  }
}
```

---

## Step 4: 重新运行测试验证全部通过

```bash
npm test -- --testPathPattern=notification-quiet-hours
```

预期：8/8 PASS。

---

## Step 5: Commit

```bash
git add super-tool-node/app/service/notification-quiet-hours.ts super-tool-node/test/notification/service/notification-quiet-hours.test.ts
git commit -m "feat(notification): add quiet-hours service with timezone & cross-midnight support

- isInQuiet: handles same-day & cross-midnight windows
- shouldSkipForType: combines user rule with type's quietHourPolicy (respect/bypass/relax)
- 8 unit tests covering timezone, disabled, all 3 policies

Refs: docs/analysis/通知推送系统模块设计需求文档.md (V2 §7.2)
Plan: docs/superpowers/plans/2026-05-23-notification-p2-1-rate-quiet-mail.md (Task 3)"
```

---

## Verification Checklist

- [ ] 测试文件存在 8 用例
- [ ] service 文件存在 2 个 public 方法
- [ ] 8 用例全 PASS
- [ ] commit 已提交

完成后进入 [`p2-1-04-rate-limit.md`](./p2-1-04-rate-limit.md)。
