# P2.1-06：EmailAdapter 真实化 + html renderer（Task 6）

> 父计划：[2026-05-23-notification-p2-1-rate-quiet-mail.md](./2026-05-23-notification-p2-1-rate-quiet-mail.md)
> 前置：Task 5（[`p2-1-05-mail-service.md`](./p2-1-05-mail-service.md)）

---

## Step 1: 创建 `app/lib/htmlEmailRenderer.ts`

```typescript
/**
 * 把"模板正文（已渲染过 {{var}}）"包装为带样式的标准邮件 HTML。
 * 简化版：不引入 mjml；admin 后续如需富文本可在 templateBody 写完整 HTML 片段。
 */
export function wrapEmailHtml(input: {
  title: string;
  bodyHtml: string;
  productName?: string;
  unsubscribeUrl?: string;
}): string {
  const product = input.productName || 'super-tools';
  const unsub = input.unsubscribeUrl
    ? `<p style="font-size:12px;color:#999;margin-top:24px;">
         若您不希望再收到此类通知，可
         <a href="${input.unsubscribeUrl}" style="color:#999;">点此退订</a>。
       </p>` : '';
  return `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>${escapeHtml(input.title)}</title></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0">
    <tr><td align="center" style="padding:24px 0;">
      <table width="600" cellpadding="0" cellspacing="0" border="0"
             style="background:#fff;border-radius:8px;overflow:hidden;">
        <tr><td style="padding:24px;background:#1677ff;color:#fff;font-size:18px;font-weight:bold;">
          ${escapeHtml(product)}
        </td></tr>
        <tr><td style="padding:24px;color:#333;font-size:14px;line-height:1.6;">
          <h2 style="margin:0 0 16px 0;font-size:16px;">${escapeHtml(input.title)}</h2>
          <div>${input.bodyHtml}</div>
          ${unsub}
        </td></tr>
        <tr><td style="padding:16px 24px;background:#fafafa;color:#999;font-size:12px;">
          此邮件由系统自动发送，请勿直接回复。
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c] as string));
}
```

---

## Step 2: 创建 `app/lib/htmlEmailRenderer.test.ts`（3 用例）

```typescript
import { strict as assert } from 'assert';
import { wrapEmailHtml } from './htmlEmailRenderer';

describe('lib/htmlEmailRenderer', () => {
  it('包含传入的 title 与 bodyHtml', () => {
    const out = wrapEmailHtml({ title: 'Hello', bodyHtml: '<p>World</p>' });
    assert.ok(out.includes('Hello'));
    assert.ok(out.includes('<p>World</p>'));
  });

  it('对 title 做 HTML 转义防注入', () => {
    const out = wrapEmailHtml({ title: '<script>x</script>', bodyHtml: 'b' });
    assert.ok(!out.includes('<script>x</script>'));
    assert.ok(out.includes('&lt;script&gt;'));
  });

  it('无 unsubscribeUrl 时不输出退订段', () => {
    const out = wrapEmailHtml({ title: 't', bodyHtml: 'b' });
    assert.ok(!out.includes('点此退订'));
  });
});
```

> 此测试可放 `test/notification/lib/htmlEmailRenderer.test.ts`，工程量 1 分钟。

---

## Step 3: 修改 `app/adapter/email.adapter.ts`，替换 P1 stub

```typescript
import { Context } from 'egg';
import { wrapEmailHtml } from '../lib/htmlEmailRenderer';
import { NOTIF_ERR } from '../constants/errorCodes';

export default class EmailAdapter {
  constructor(private ctx: Context) {}

  async send(message: any): Promise<{ ok: boolean; messageId?: string }> {
    const user = await this.ctx.model.User.findByPk(message.userId);
    if (!user?.email) {
      // 用户没邮箱 → 直接 failed，但不重试
      await message.update({ status: 'failed', failReason: 'user has no email' });
      await this.ctx.model.NotificationSendLog.create({
        messageId: message.id, channel: 'email', status: 'failed',
        errorMessage: 'no_email',
      });
      return { ok: false };
    }

    const html = wrapEmailHtml({
      title: message.title,
      bodyHtml: message.body, // 已经过 P1 templateRenderer 转义
      productName: 'super-tools',
      unsubscribeUrl: this._buildUnsubscribeUrl(message),
    });

    try {
      const r = await this.ctx.service.mail.sendOnce({
        to: user.email,
        subject: message.title,
        html,
        headers: { 'X-Notification-Id': String(message.id) },
      });
      await message.update({ status: 'sent', sentAt: new Date() });
      await this.ctx.model.NotificationSendLog.create({
        messageId: message.id, channel: 'email', status: 'success',
        providerResp: { messageId: r.messageId },
      });
      return { ok: true, messageId: r.messageId };
    } catch (e: any) {
      // 抛回让 worker 进入 BullMQ 重试机制
      this.ctx.throwBiz(NOTIF_ERR.EMAIL_SEND_FAILED, e.message);
    }
    return { ok: false };
  }

  private _buildUnsubscribeUrl(message: any): string {
    const base = this.ctx.app.config.notification.frontend?.h5BaseUrl || '';
    return `${base}/settings/notification?uid=${message.userId}&typeId=${message.typeId}`;
  }
}
```

---

## Step 4: 扩展通道适配器测试（在 P1 已有的文件追加 1 用例）

文件：`test/notification/service/notification-channel.test.ts`

```typescript
it('email 渠道走真实 EmailAdapter，调用 mail.sendOnce', async () => {
  let called = false;
  mock(app.serviceClasses.mail.prototype, 'sendOnce', async () => {
    called = true; return { messageId: '<id1>' };
  });
  await ctx.model.User.upsert({
    id: 1, email: 'u1@test.com', mobile: '13800000001', status: 1,
  });
  const msg = await ctx.model.NotificationMessage.create({
    userId: 1, typeId: 1, channel: 'email',
    title: 't', body: 'b', priority: 'normal', status: 'pending',
  });
  await ctx.service.notificationChannel.dispatch({ channel: 'email', message: msg });
  assert.equal(called, true);
  await msg.reload();
  assert.equal(msg.status, 'sent');
});

it('email 用户无 email → status=failed 且不抛', async () => {
  await ctx.model.User.upsert({
    id: 2, email: null, mobile: '13800000002', status: 1,
  });
  const msg = await ctx.model.NotificationMessage.create({
    userId: 2, typeId: 1, channel: 'email',
    title: 't', body: 'b', priority: 'normal', status: 'pending',
  });
  const r = await ctx.service.notificationChannel.dispatch({ channel: 'email', message: msg });
  assert.equal(r.ok, false);
  await msg.reload();
  assert.equal(msg.status, 'failed');
});
```

---

## Step 5: 运行所有 mail 相关测试

```bash
npm test -- --testPathPattern='(mail|notification-channel|htmlEmailRenderer)'
```

预期：所有相关用例 PASS。

---

## Step 6: Commit

```bash
git add super-tool-node/app/adapter/email.adapter.ts super-tool-node/app/lib/htmlEmailRenderer.ts super-tool-node/test/notification/lib/htmlEmailRenderer.test.ts super-tool-node/test/notification/service/notification-channel.test.ts
git commit -m "feat(notification): replace EmailAdapter stub with nodemailer + html wrapper

- Render message via wrapEmailHtml (escape title, no-script CSS-only layout)
- User without email → status=failed (no retry)
- SMTP failure throws 108602 → bullmq retries 3 times
- Add unsubscribe link pointing to /settings/notification
- 3 renderer tests + 2 adapter integration tests

Refs: docs/analysis/通知推送系统模块设计需求文档.md (V2 §6.5)
Plan: docs/superpowers/plans/2026-05-23-notification-p2-1-rate-quiet-mail.md (Task 6)"
```

---

## Verification Checklist

- [ ] `htmlEmailRenderer.ts` 含 `wrapEmailHtml + escapeHtml`
- [ ] `email.adapter.ts` 已替换 P1 stub
- [ ] 所有相关测试 PASS
- [ ] commit 已提交

完成后进入 [`p2-1-07-send-integration.md`](./p2-1-07-send-integration.md)。
