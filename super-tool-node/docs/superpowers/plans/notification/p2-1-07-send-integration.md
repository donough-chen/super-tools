# P2.1-07：notification.send 插入 quiet → rate 检查（Task 7）

> 父计划：[2026-05-23-notification-p2-1-rate-quiet-mail.md](./2026-05-23-notification-p2-1-rate-quiet-mail.md)
> 前置：Task 3（quiet-hours）+ Task 4（rate-limit）

---

## Step 1: 修改 `app/service/notification.ts`

在 `_dispatchToUser` 方法内、`for (const channel of args.channels)` 循环刚开始处插入两段检查。

- [ ] 修改后 `_dispatchToUser` 形如（关键改动用注释标明）：

```typescript
  private async _dispatchToUser(args: {
    type: any;
    userId: number;
    channels: ('inApp' | 'email' | 'sms')[];
    params: Record<string, any>;
    bizRefType?: string;
    bizRefId?: string;
    taskId: number | null;
    lang: string;
    /** sendDirect 路径下为 true，跳过偏好/静默/频控 */
    bypassGuards?: boolean;
  }) {
    const { ctx, app } = this;
    const queue = getSendQueue(app);
    const messages: any[] = [];

    for (const channel of args.channels) {
      // ===== P2.1 新增：静默检查 =====
      if (!args.bypassGuards) {
        const quietSkip = await ctx.service.notificationQuietHours.shouldSkipForType({
          userId: args.userId,
          typeQuietPolicy: args.type.quietHourPolicy ?? 'respect',
          channel,
        });
        if (quietSkip) {
          await ctx.model.NotificationSendLog.create({
            messageId: null, channel, status: 'skipped',
            errorMessage: 'quiet_hour',
            extra: { typeId: args.type.id, userId: args.userId },
          });
          ctx.logger.info(
            `[notif] skip quiet user=${args.userId} type=${args.type.typeKey} ch=${channel}`,
          );
          continue;
        }

        // ===== P2.1 新增：频控检查 =====
        const rate = await ctx.service.notificationRateLimit.check({
          userId: args.userId, typeId: args.type.id, channel,
        });
        if (!rate.allowed) {
          await ctx.model.NotificationSendLog.create({
            messageId: null, channel, status: 'skipped',
            errorMessage: `rate_limited:${rate.hitRule?.scope}:${rate.hitRule?.id}`,
            extra: { typeId: args.type.id, userId: args.userId, rule: rate.hitRule },
          });
          ctx.logger.info(
            `[notif] skip rate user=${args.userId} type=${args.type.typeKey} ch=${channel} rule=${rate.hitRule?.id}`,
          );
          continue;
        }
      }

      // 以下保持 P1 原逻辑：渲染模板 → 入库 → 入队
      const rendered = await ctx.service.notificationTemplate.renderByType({
        typeKey: args.type.typeKey, channel, lang: args.lang, params: args.params,
      });
      const msg = await ctx.model.NotificationMessage.create({
        taskId: args.taskId,
        userId: args.userId,
        typeId: args.type.id,
        channel,
        templateId: rendered.templateId,
        templateVersion: rendered.templateVersion,
        title: rendered.title,
        body: rendered.body,
        priority: args.type.priority ?? 'normal',
        status: 'pending',
        bizRefType: args.bizRefType ?? null,
        bizRefId: args.bizRefId ?? null,
      });
      await queue.add('send', { messageId: msg.id, channel }, {
        jobId: `msg-${msg.id}-${channel}`,
      });
      messages.push({ id: msg.id, channel });
    }
    return { skipped: false, messages };
  }
```

- [ ] `sendDirect` 路径中调用 `_dispatchToUser` 时传 `bypassGuards: true`：

```typescript
async sendDirect(input: SendDirectInput) {
  const type = await this._loadEnabledType(input.typeKey);
  const channels = input.channels && input.channels.length > 0
    ? input.channels
    : type.defaultChannels;
  return this._dispatchToUser({
    type, userId: input.userId, channels,
    params: input.params, bizRefType: input.bizRefType, bizRefId: input.bizRefId,
    taskId: input.taskId ?? null, lang: input.lang ?? 'zh-CN',
    bypassGuards: true,   // ← 新增
  });
}
```

- [ ] `send` 路径不传 `bypassGuards`，默认走全部检查。

> **重要**：`send` 方法外层已经做了"用户偏好 enabled / channels 过滤"，本步新增的是其后的 quiet→rate；执行顺序固定为：偏好（外层）→ 静默 → 频控（本步）→ 渲染入库入队。

---

## Step 2: 创建集成测试 `test/notification/service/notification-send-with-rate.test.ts`

```typescript
import { app, assert } from 'egg-mock/bootstrap';

describe('service/notification.send + quiet/rate integration', () => {
  let ctx: any;
  beforeEach(async () => {
    ctx = app.mockContext();
    const redis: any = app.redis;
    const keys = await redis.keys('notif:rl:*');
    if (keys.length) await redis.del(...keys);
    await ctx.model.NotificationRateLimitConfig.destroy({
      where: { description: { [app.Sequelize.Op.like]: 'TEST_%' } }, force: true,
    });
    await ctx.model.NotificationUserQuietHours.destroy({
      where: { userId: { [app.Sequelize.Op.in]: [9100, 9101, 9102] } }, force: true,
    });
    (ctx.service.notificationRateLimit as any).invalidateCache();
  });

  it('用户在静默期 → channel=inApp 跳过，写 send_log skipped', async () => {
    await ctx.model.NotificationUserQuietHours.create({
      userId: 9100, startAt: '00:00', endAt: '23:59',
      timezone: 'Asia/Shanghai', enabled: 1,
    });
    const r = await ctx.service.notification.send({
      typeKey: 'feedback_reply', userId: 9100, params: { content: 'x' },
      channels: ['inApp'],
    });
    assert.equal(r.skipped, false); // _dispatchToUser 自身的 skipped 是不同语义；通道循环内全部跳过 → messages=[]
    assert.equal(r.messages.length, 0);
    const log = await ctx.model.NotificationSendLog.findOne({
      where: { errorMessage: 'quiet_hour' }, order: [['id', 'DESC']],
    });
    assert.ok(log);
  });

  it('频控命中 → 第 N 条跳过，前 N-1 条入队', async () => {
    await ctx.model.NotificationRateLimitConfig.create({
      scope: 'user_global', typeId: null, channel: null,
      windowSeconds: 60, maxCount: 2, enabled: 1, description: 'TEST_send_rate',
    });
    (ctx.service.notificationRateLimit as any).invalidateCache();
    let allowedTotal = 0;
    for (let i = 0; i < 5; i++) {
      const r = await ctx.service.notification.send({
        typeKey: 'feedback_reply', userId: 9101, params: { content: String(i) },
        channels: ['inApp'],
      });
      allowedTotal += r.messages.length;
    }
    assert.equal(allowedTotal, 2);
    const skipped = await ctx.model.NotificationSendLog.count({
      where: { errorMessage: { [app.Sequelize.Op.like]: 'rate_limited:%' } },
    });
    assert.equal(skipped >= 3, true);
  });

  it('安全类 type quietHourPolicy=bypass → 静默期仍下发', async () => {
    await ctx.model.NotificationUserQuietHours.create({
      userId: 9102, startAt: '00:00', endAt: '23:59',
      timezone: 'Asia/Shanghai', enabled: 1,
    });
    const r = await ctx.service.notification.sendDirect({
      typeKey: 'unusual_login', userId: 9102, params: { ip: '1.1.1.1' },
    });
    assert.equal(r.skipped, false);
    assert.equal(r.messages.length >= 1, true);
  });
});
```

> 注：用例 1 中 `r.skipped` 含义说明 —— `notification.send` 顶层 `skipped` 仅在"偏好关闭/无可用渠道"时为 true；channel 循环内被静默跳过会 `continue`，最终 `messages=[]` 但顶层 `skipped=false`。这是合理的：调用方应同时检查 `skipped` 与 `messages.length`。

---

## Step 3: 验证

```bash
npm test -- --testPathPattern='notification\.test|notification-send-with-rate'
```

预期：P1 已有 send 用例继续通过 + 新增 3 个集成用例 PASS。

---

## Step 4: Commit

```bash
git add super-tool-node/app/service/notification.ts super-tool-node/test/notification/service/notification-send-with-rate.test.ts
git commit -m "feat(notification): integrate quiet-hour & rate-limit checks into send pipeline

- _dispatchToUser inserts quiet→rate before render+enqueue
- sendDirect passes bypassGuards=true to skip both checks
- Skipped channels write notification_send_logs with extra json
- Order: preference (outer) → quiet → rate → render → DB → queue
- 3 integration tests covering quiet skip, rate exhaust, sendDirect bypass

Refs: docs/analysis/通知推送系统模块设计需求文档.md (V2 §6.3 §7.1)
Plan: docs/superpowers/plans/2026-05-23-notification-p2-1-rate-quiet-mail.md (Task 7)"
```

---

## Verification Checklist

- [ ] `_dispatchToUser` 含 quiet 与 rate 两段检查
- [ ] `sendDirect` 调用时 `bypassGuards: true`
- [ ] P1 已有 send 用例不回归
- [ ] 3 个集成用例 PASS
- [ ] commit 已提交

完成后进入 [`p2-1-08-admin-api.md`](./p2-1-08-admin-api.md)。
