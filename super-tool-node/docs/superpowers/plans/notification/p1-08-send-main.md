# P1-08：notification.send 主入口 + 完整测试

> 父计划：[2026-05-16-notification-phase-1-00-overview.md](./2026-05-16-notification-phase-1-00-overview.md)
> 包含 Task：**T11**
> 前置：T6（template）、T7（preference）、T8（audience）、T10（channel dispatch）

---

## Task 11：notification.send 主入口 + 测试

**目标**：实现业务调用的统一入口 `ctx.service.notification.send(...)`，串联：

1. 取 type → 检查启用状态
2. 取偏好 → 过滤渠道 + 检查 enabled
3. 渲染模板 → 入库 NotificationMessage
4. 入队 BullMQ（按渠道）

P1 主入口仅暴露：

- `send(input)`：单接收者快速调用
- `sendDirect(input)`：跳过偏好的强制下发（用于安全/系统级）
- `sendByAudience(input)`：通过 audience 解析后批量

### 11.1 测试：`test/notification/service/notification.test.ts`

```typescript
import { app, mock, assert } from 'egg-mock/bootstrap';

describe('service/notification.ts', () => {
  let ctx: any;
  beforeEach(async () => {
    ctx = app.mockContext();
  });

  describe('send（单用户）', () => {
    it('成功发送 → 写库 + 入队', async () => {
      let queued: any = null;
      mock(require('../../../app/queue/queues'), 'getSendQueue', () => ({
        add: async (_n: string, data: any) => { queued = data; return { id: 'mock-job' }; },
      }));
      const r = await ctx.service.notification.send({
        typeKey: 'feedback_reply',
        userId: 1,
        params: { content: '回复内容' },
      });
      assert.equal(r.skipped, false);
      assert.equal(r.messages.length >= 1, true);
      const msg = await ctx.model.NotificationMessage.findByPk(r.messages[0].id);
      assert.equal(msg.userId, 1);
      assert.equal(msg.status, 'pending');
      assert.ok(queued);
    });

    it('用户偏好关闭该 type → skipped=true，不写库', async () => {
      const type = await ctx.model.NotificationType.findOne({ where: { typeKey: 'feedback_reply' } });
      await ctx.model.NotificationUserPreference.upsert({
        userId: 2, typeId: type.id, channels: [], enabled: 0,
      });
      const r = await ctx.service.notification.send({
        typeKey: 'feedback_reply', userId: 2, params: { content: 'x' },
      });
      assert.equal(r.skipped, true);
      assert.equal(r.messages.length, 0);
    });

    it('type 不存在 → 抛 NOTIF_TYPE_NOT_FOUND', async () => {
      await assert.rejects(
        ctx.service.notification.send({ typeKey: 'no_such_xxx', userId: 1, params: {} }),
        /108101/,
      );
    });

    it('type.enabled=0 → 抛 NOTIF_TYPE_DISABLED', async () => {
      const type = await ctx.model.NotificationType.findOne({ where: { typeKey: 'feedback_reply' } });
      const original = type.enabled;
      await type.update({ enabled: 0 });
      await assert.rejects(
        ctx.service.notification.send({ typeKey: 'feedback_reply', userId: 1, params: {} }),
        /108103/,
      );
      await type.update({ enabled: original }); // 恢复
    });

    it('显式指定 channels 过滤偏好', async () => {
      // type 默认 [inApp,email,sms]，偏好[inApp]，传入channels=[email,sms] → 取交集 = []
      const type = await ctx.model.NotificationType.findOne({ where: { typeKey: 'feedback_reply' } });
      await ctx.model.NotificationUserPreference.upsert({
        userId: 3, typeId: type.id, channels: ['inApp'], enabled: 1,
      });
      const r = await ctx.service.notification.send({
        typeKey: 'feedback_reply', userId: 3, params: { content: 'x' },
        channels: ['email'],
      });
      assert.equal(r.skipped, true);
    });
  });

  describe('sendDirect（跳过偏好）', () => {
    it('用户已关闭偏好仍然下发', async () => {
      const type = await ctx.model.NotificationType.findOne({ where: { typeKey: 'unusual_login' } });
      await ctx.model.NotificationUserPreference.upsert({
        userId: 4, typeId: type.id, channels: [], enabled: 0,
      });
      const r = await ctx.service.notification.sendDirect({
        typeKey: 'unusual_login', userId: 4, params: { ip: '1.1.1.1' },
      });
      assert.equal(r.skipped, false);
      assert.equal(r.messages.length >= 1, true);
    });
  });

  describe('sendByAudience（批量）', () => {
    it('audienceType=static 给每个用户下发', async () => {
      const r = await ctx.service.notification.sendByAudience({
        typeKey: 'system_broadcast',
        audienceType: 'static',
        audienceRule: { userIds: [10, 11, 12] },
        params: { announcement: '系统升级' },
      });
      assert.equal(r.totalUsers, 3);
      assert.equal(r.totalMessages >= 3, true);
    });
  });
});
```

> 测试前置数据要求：迁移已执行；`feedback_reply` / `unusual_login` / `system_broadcast` 三个 type 存在（来自 T4 预置）。

### 11.2 实现：`app/service/notification.ts`

```typescript
import { Service } from 'egg';
import { getSendQueue } from '../queue/queues';
import { NOTIF_ERR } from '../constants/errorCodes';

export interface SendInput {
  typeKey: string;
  userId: number;
  params: Record<string, any>;
  channels?: ('inApp' | 'email' | 'sms')[];
  bizRefType?: string;
  bizRefId?: string;
  taskId?: number | null;
  lang?: string;
}

export interface SendDirectInput extends SendInput {}

export interface SendByAudienceInput {
  typeKey: string;
  audienceType: 'all' | 'static' | 'dynamic';
  audienceRule: any;
  params: Record<string, any>;
  channels?: ('inApp' | 'email' | 'sms')[];
  taskId?: number | null;
  lang?: string;
}

export default class NotificationService extends Service {

  async send(input: SendInput) {
    const { ctx } = this;
    const type = await this._loadEnabledType(input.typeKey);
    const pref = await ctx.service.notificationPreference.getEffective({
      userId: input.userId, typeId: type.id,
    });
    if (!pref.enabled) return { skipped: true, reason: 'pref_disabled', messages: [] };

    const allowedChannels = input.channels
      ? input.channels.filter((c) => pref.channels.includes(c))
      : pref.channels;
    if (allowedChannels.length === 0) return { skipped: true, reason: 'no_channel', messages: [] };

    return this._dispatchToUser({
      type, userId: input.userId, channels: allowedChannels,
      params: input.params, bizRefType: input.bizRefType, bizRefId: input.bizRefId,
      taskId: input.taskId ?? null, lang: input.lang ?? 'zh-CN',
    });
  }

  async sendDirect(input: SendDirectInput) {
    const { ctx } = this;
    const type = await this._loadEnabledType(input.typeKey);
    const channels = input.channels && input.channels.length > 0
      ? input.channels
      : type.defaultChannels;
    return this._dispatchToUser({
      type, userId: input.userId, channels,
      params: input.params, bizRefType: input.bizRefType, bizRefId: input.bizRefId,
      taskId: input.taskId ?? null, lang: input.lang ?? 'zh-CN',
    });
  }

  async sendByAudience(input: SendByAudienceInput) {
    const { ctx } = this;
    const userIds = await ctx.service.notificationAudience.resolve({
      audienceType: input.audienceType,
      audienceRule: input.audienceRule,
    });
    let totalMessages = 0;
    for (const uid of userIds) {
      try {
        const r = await this.send({
          typeKey: input.typeKey, userId: uid, params: input.params,
          channels: input.channels, taskId: input.taskId ?? null, lang: input.lang,
        });
        totalMessages += r.messages.length;
      } catch (e: any) {
        ctx.logger.warn(`[notif.sendByAudience] user=${uid} failed: ${e.message}`);
      }
    }
    return { totalUsers: userIds.length, totalMessages };
  }

  // -------- 内部 --------

  private async _loadEnabledType(typeKey: string) {
    const { ctx } = this;
    const type = await ctx.model.NotificationType.findOne({ where: { typeKey } });
    if (!type) ctx.throwBiz(NOTIF_ERR.TYPE_NOT_FOUND);
    if (!type.enabled) ctx.throwBiz(NOTIF_ERR.TYPE_DISABLED);
    return type;
  }

  private async _dispatchToUser(args: {
    type: any;
    userId: number;
    channels: ('inApp' | 'email' | 'sms')[];
    params: Record<string, any>;
    bizRefType?: string;
    bizRefId?: string;
    taskId: number | null;
    lang: string;
  }) {
    const { ctx, app } = this;
    const queue = getSendQueue(app);
    const messages: any[] = [];
    for (const channel of args.channels) {
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
        jobId: `msg-${msg.id}-${channel}`, // 幂等
      });
      messages.push({ id: msg.id, channel });
    }
    return { skipped: false, messages };
  }
}
```

### 11.3 验证

- [ ] `npm test -- --testPathPattern=notification\\.test` 全绿（≥ 7 用例）
- [ ] dev 启动后从 REPL `app.curl(...)` 调用反馈回复触发点，能看到：
  - DB `notification_messages` 新增行
  - Worker 日志 `[notif.send] worker job=msg-XX-inApp completed`
  - `notification_send_logs` 新增 success 行（如 channel=email/sms）

### 11.4 Commit

```
feat(notification): add notification main service (send/sendDirect/sendByAudience)

- send: respects user preferences, returns skipped flag
- sendDirect: bypasses preferences for system-critical messages
- sendByAudience: resolves audience to user list and dispatches per-user
- enqueues to bullmq with idempotent jobId msg-{id}-{channel}

Refs: docs/analysis/通知推送系统模块设计需求文档.md (V2 §6.3)
```

---

## 完成检查

- [ ] `app/service/notification.ts` 三个公开方法签名稳定
- [ ] 单测覆盖：偏好关闭跳过 / 显式 channels 取交集 / type 不存在 / type 禁用 / sendDirect 强制 / sendByAudience 批量
- [ ] 写库幂等：相同 jobId 不会重复入队
- [ ] 错误码：`108101 TYPE_NOT_FOUND` / `108103 TYPE_DISABLED` 已使用
