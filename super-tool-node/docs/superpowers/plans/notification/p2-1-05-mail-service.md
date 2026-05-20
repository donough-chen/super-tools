# P2.1-05：mail.ts (nodemailer pool) + 测试（Task 5）

> 父计划：[2026-05-23-notification-p2-1-rate-quiet-mail.md](./2026-05-23-notification-p2-1-rate-quiet-mail.md)
> 前置：Task 1（[`p2-1-01-deps-config.md`](./p2-1-01-deps-config.md)）

---

## Step 1: 创建测试 `test/notification/service/mail.test.ts`（6 用例）

```typescript
import { app, mock, assert } from 'egg-mock/bootstrap';

describe('service/mail', () => {
  let ctx: any;
  beforeEach(() => { ctx = app.mockContext(); });

  it('sendOnce 调用 transport.sendMail 并返回 messageId', async () => {
    let capturedOpts: any = null;
    mock(app.serviceClasses.mail.prototype, '_getTransport', async () => ({
      sendMail: async (opts: any) => {
        capturedOpts = opts;
        return { messageId: '<mocked-id>', accepted: [opts.to], rejected: [] };
      },
    }));
    const r = await ctx.service.mail.sendOnce({
      to: 'a@b.com', subject: 's', html: '<p>hi</p>', text: 'hi',
    });
    assert.equal(r.messageId, '<mocked-id>');
    assert.equal(capturedOpts.to, 'a@b.com');
    assert.equal(capturedOpts.subject, 's');
  });

  it('reject 列表非空时抛 EMAIL_SEND_FAILED (108602)', async () => {
    mock(app.serviceClasses.mail.prototype, '_getTransport', async () => ({
      sendMail: async () => ({ messageId: '<x>', accepted: [], rejected: ['a@b.com'] }),
    }));
    await assert.rejects(
      ctx.service.mail.sendOnce({ to: 'a@b.com', subject: 's', html: 'x' }),
      /108602/,
    );
  });

  it('verifyTransport 调用 transport.verify', async () => {
    let called = false;
    mock(app.serviceClasses.mail.prototype, '_getTransport', async () => ({
      verify: async () => { called = true; return true; },
    }));
    const ok = await ctx.service.mail.verifyTransport();
    assert.equal(called, true);
    assert.equal(ok, true);
  });

  it('verifyTransport 失败时返回 false（不抛）', async () => {
    mock(app.serviceClasses.mail.prototype, '_getTransport', async () => ({
      verify: async () => { throw new Error('connect ECONNREFUSED'); },
    }));
    const ok = await ctx.service.mail.verifyTransport();
    assert.equal(ok, false);
  });

  it('使用 DB 中 isDefault=1 的 SMTP 配置覆盖 config.default', async () => {
    await ctx.model.NotificationChannelConfig.update(
      { config: { host: 'smtp.from-db', port: 25, secure: false, auth_user: 'x', auth_pass: 'y' } },
      { where: { channel: 'email', isDefault: 1 } },
    );
    let host: string | null = null;
    mock(require('nodemailer'), 'createTransport', (opts: any) => {
      host = opts.host;
      return { sendMail: async () => ({ messageId: '<x>', accepted: ['a@b.com'], rejected: [] }) };
    });
    await ctx.service.mail.reload();
    await ctx.service.mail.sendOnce({ to: 'a@b.com', subject: 's', html: 'x' });
    assert.equal(host, 'smtp.from-db');
  });

  it('healthCheck 写库 lastHealthAt / lastHealthOk', async () => {
    mock(app.serviceClasses.mail.prototype, '_getTransport', async () => ({
      verify: async () => true,
      sendMail: async () => ({ messageId: '<x>', accepted: ['a@b.com'], rejected: [] }),
    }));
    await ctx.service.mail.healthCheck();
    const row = await ctx.model.NotificationChannelConfig.findOne({
      where: { channel: 'email', isDefault: 1 },
    });
    assert.equal(row.lastHealthOk, 1);
    assert.ok(row.lastHealthAt);
  });
});
```

---

## Step 2: 运行测试验证全 FAIL

```bash
npm test -- --testPathPattern=service/mail.test
```

预期：6 用例全部 FAIL（service 不存在）。

---

## Step 3: 创建实现 `app/service/mail.ts`

```typescript
import { Service } from 'egg';
import nodemailer, { Transporter } from 'nodemailer';
import { NOTIF_ERR } from '../constants/errorCodes';

export default class MailService extends Service {

  private static _transport: Transporter | null = null;
  private static _signature: string | null = null;

  async sendOnce(input: {
    to: string;
    subject: string;
    html?: string;
    text?: string;
    headers?: Record<string, string>;
  }): Promise<{ messageId: string }> {
    const transport = await this._getTransport();
    const { from } = this.app.config.notification.mail;
    const result = await transport.sendMail({
      from,
      to: input.to,
      subject: input.subject,
      html: input.html,
      text: input.text || (input.html ? input.html.replace(/<[^>]+>/g, '') : ''),
      headers: input.headers,
    });
    if (result.rejected && result.rejected.length > 0) {
      this.ctx.throwBiz(NOTIF_ERR.EMAIL_SEND_FAILED, `rejected: ${result.rejected.join(',')}`);
    }
    return { messageId: result.messageId };
  }

  async verifyTransport(): Promise<boolean> {
    try {
      const transport = await this._getTransport();
      await (transport as any).verify();
      return true;
    } catch (e: any) {
      this.ctx.logger.warn(`[mail] verify failed: ${e.message}`);
      return false;
    }
  }

  async healthCheck(): Promise<void> {
    const ok = await this.verifyTransport();
    await this.ctx.model.NotificationChannelConfig.update(
      { lastHealthAt: new Date(), lastHealthOk: ok ? 1 : 0 },
      { where: { channel: 'email', isDefault: 1 } },
    );
  }

  /** admin 修改 SMTP 配置后调用 */
  async reload(): Promise<void> {
    MailService._transport = null;
    MailService._signature = null;
  }

  protected async _getTransport(): Promise<Transporter> {
    const sig = await this._loadSignature();
    if (MailService._transport && MailService._signature === sig) return MailService._transport;

    const cfg = await this._loadEffectiveConfig();
    MailService._transport = nodemailer.createTransport({
      host: cfg.host,
      port: cfg.port,
      secure: cfg.secure,
      pool: cfg.pool ?? true,
      maxConnections: cfg.maxConnections ?? 5,
      maxMessages: cfg.maxMessages ?? 100,
      auth: { user: cfg.auth_user, pass: cfg.auth_pass },
    });
    MailService._signature = sig;
    return MailService._transport;
  }

  private async _loadEffectiveConfig() {
    const dbRow = await this.ctx.model.NotificationChannelConfig.findOne({
      where: { channel: 'email', enabled: 1, isDefault: 1 },
    });
    if (dbRow?.config) return dbRow.config;
    const c = this.app.config.notification.mail.transport;
    return {
      host: c.host, port: c.port, secure: c.secure,
      pool: c.pool, maxConnections: c.maxConnections, maxMessages: c.maxMessages,
      auth_user: c.auth.user, auth_pass: c.auth.pass,
    };
  }

  private async _loadSignature(): Promise<string> {
    const cfg = await this._loadEffectiveConfig();
    return [cfg.host, cfg.port, cfg.secure, cfg.auth_user].join('|');
  }
}
```

---

## Step 4: 运行测试验证 6/6 PASS

```bash
npm test -- --testPathPattern=service/mail.test
```

---

## Step 5: Commit

```bash
git add super-tool-node/app/service/mail.ts super-tool-node/test/notification/service/mail.test.ts
git commit -m "feat(notification): add mail service (nodemailer pool with db-driven config + healthcheck)

- Lazy-init transporter; reload() invalidates pool when admin updates config
- Falls back to config.default when DB row missing
- verifyTransport returns boolean (no throw); healthCheck writes lastHealthAt/Ok
- 6 unit tests cover send/reject/verify/db-override/healthcheck

Refs: docs/analysis/通知推送系统模块设计需求文档.md (V2 §6.5 §7.4)
Plan: docs/superpowers/plans/2026-05-23-notification-p2-1-rate-quiet-mail.md (Task 5)"
```

---

## Verification Checklist

- [ ] service 含 `sendOnce / verifyTransport / healthCheck / reload` 4 个 public 方法
- [ ] 6 用例全 PASS
- [ ] commit 已提交

完成后进入 [`p2-1-06-email-adapter.md`](./p2-1-06-email-adapter.md)。
