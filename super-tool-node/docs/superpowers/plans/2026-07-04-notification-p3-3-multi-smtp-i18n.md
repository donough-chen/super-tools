# P3.3：多 SMTP 自动切换 + 模板国际化 i18n

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development.

**Goal:**
1. **多 SMTP**：邮件渠道支持多服务商（主/备），按健康状态自动切换；admin 可配置优先级与权重
2. **i18n**：模板支持 zh-CN + en-US 双语；C 端用户偏好语言决定渲染哪个版本

**Architecture:**
- 多 SMTP：扩展 P2.1 的 `mail.ts`，从 `notification_channel_config` 加载多条 enabled 配置，按 `priority` 排序，主 SMTP 失败自动切换到备；定时健康检查每 5 分钟更新 `last_health_at/ok`
- i18n：扩展 P1 `notification-template service`，按用户 `users.lang` 字段选模板（找不到回退 zh-CN）；新增 admin 端"语言切换"Tab 显示同一类型的多语言模板

**Tech Stack:** Egg.js + 复用 P2.1 nodemailer / P1 templateRenderer

**前置条件**：tag `p3-2-done`；P2.1 mail.ts 与 channel_config 表已就绪。

**Reference:** 需求文档 V2 §6.5（多 SMTP）+ §8.8（i18n）

---

## 范围

### ✅ 做

- DB 迁移 025：channel_config 加 `priority` 字段；users 表加 `lang` 字段（如未有）
- mail.ts 改造：多 transport 池 + 健康检查 + 故障转移（attempts=2 切换 provider）
- 模板渲染改造：按 `lang` 选模板，回退 zh-CN
- 用户 C 端 API 加 PUT `/api/users/me/lang`
- admin Templates 页面加"语言"列 + 复制到其他语言按钮
- 错误码 108720-108725

### ❌ 不做（P3.4）

- 短信真实接入（P3.4）
- 大任务进度推送（P3.4）

---

## 任务列表（7 Tasks）

| # | Task |
|---|------|
| 1 | DB 迁移 025（channel.priority + users.lang）+ 错误码 |
| 2 | mail.ts 多 SMTP 改造 + 5 单测 |
| 3 | 健康检查 schedule（每 5 分钟）+ 自动 fallback 测试 |
| 4 | template 渲染按 lang 选择 + fallback zh-CN + 5 单测 |
| 5 | C 端 API：用户语言偏好 |
| 6 | admin Templates UI 增加"语言"过滤 + 复制按钮 |
| 7 | 端到端联调 + 验收 + tag p3-3-done |

---

## Task 1：DB 迁移 025 + 错误码

`database/025_p3_multi_smtp_i18n.sql`：

```sql
-- 1. channel_config 加 priority（数字越小越优先）
ALTER TABLE `notification_channel_config`
  ADD COLUMN `priority` INT NOT NULL DEFAULT 100 COMMENT '主备优先级，越小越优先' AFTER `is_default`,
  ADD INDEX `idx_channel_priority` (`channel`, `enabled`, `priority`);

-- 2. users 表加 lang
ALTER TABLE `users`
  ADD COLUMN `lang` VARCHAR(10) NOT NULL DEFAULT 'zh-CN' COMMENT '用户语言偏好' AFTER `status`;

-- 3. 现有 SMTP 设为 priority=10（主）
UPDATE `notification_channel_config`
  SET `priority` = 10
  WHERE `channel` = 'email' AND `is_default` = 1;
```

回滚：DROP COLUMN priority + DROP INDEX + DROP COLUMN lang。

错误码 errorCodes.ts：

```typescript
NOTIFY_MAIL_ALL_PROVIDERS_DOWN: { code: 108720, message: '所有邮件服务商均不可用' },
NOTIFY_MAIL_PROVIDER_NOT_FOUND: { code: 108721, message: '指定的邮件服务商不存在' },
NOTIFY_I18N_LANG_INVALID:       { code: 108722, message: '不支持的语言' },
NOTIFY_I18N_TEMPLATE_MISSING:   { code: 108723, message: '模板缺失目标语言版本' },
```

`SUPPORTED_LANGS = ['zh-CN', 'en-US']` 写在 `app/lib/i18n.ts`。

```bash
git commit -m "feat(notification): db migration 025 (channel.priority + users.lang) + 4 errcodes"
```

---

## Task 2：mail.ts 多 SMTP 改造

修改 `app/service/mail.ts`，把单 transport 改为 transport pool by provider id：

```typescript
import { Service } from 'egg';
import nodemailer, { Transporter } from 'nodemailer';
import { NOTIF_ERR } from '../constants/errorCodes';

interface ProviderEntry {
  configId: number;
  priority: number;
  signature: string;
  transport: Transporter;
  lastHealthOk: boolean;
}

export default class MailService extends Service {

  private static _pool: ProviderEntry[] = [];
  private static _loaded = false;

  async sendOnce(input: {
    to: string; subject: string; html?: string; text?: string;
    headers?: Record<string, string>;
  }): Promise<{ messageId: string; provider: number }> {
    await this._ensureLoaded();
    const candidates = this._sortedHealthy();
    if (candidates.length === 0) this.ctx.throwBiz(NOTIF_ERR.MAIL_ALL_PROVIDERS_DOWN);
    let lastErr: any;
    for (const p of candidates) {
      try {
        const result = await p.transport.sendMail({
          from: this.app.config.notification.mail.from,
          to: input.to,
          subject: input.subject,
          html: input.html,
          text: input.text,
          headers: input.headers,
        });
        if (result.rejected?.length > 0) throw new Error(`rejected: ${result.rejected.join(',')}`);
        return { messageId: result.messageId, provider: p.configId };
      } catch (e: any) {
        lastErr = e;
        this.ctx.logger.warn(`[mail] provider ${p.configId} failed: ${e.message}, trying next`);
        await this._markUnhealthy(p);
      }
    }
    this.ctx.throwBiz(NOTIF_ERR.EMAIL_SEND_FAILED, lastErr?.message || 'all providers failed');
    return null as any;
  }

  async healthCheckAll() {
    await this._ensureLoaded();
    for (const p of MailService._pool) {
      try {
        await (p.transport as any).verify();
        p.lastHealthOk = true;
        await this.ctx.model.NotificationChannelConfig.update(
          { lastHealthAt: new Date(), lastHealthOk: 1 },
          { where: { id: p.configId } },
        );
      } catch (e: any) {
        p.lastHealthOk = false;
        await this.ctx.model.NotificationChannelConfig.update(
          { lastHealthAt: new Date(), lastHealthOk: 0 },
          { where: { id: p.configId } },
        );
      }
    }
  }

  async reload() {
    MailService._pool = [];
    MailService._loaded = false;
    await this._ensureLoaded();
  }

  // -------- 内部 --------

  private async _ensureLoaded() {
    if (MailService._loaded) return;
    const rows = await this.ctx.model.NotificationChannelConfig.findAll({
      where: { channel: 'email', enabled: 1 },
      order: [['priority', 'ASC'], ['id', 'ASC']],
    });
    MailService._pool = rows.map((r: any) => {
      const c = r.config;
      const sig = [c.host, c.port, c.secure, c.auth_user].join('|');
      return {
        configId: r.id,
        priority: r.priority ?? 100,
        signature: sig,
        lastHealthOk: r.lastHealthOk == null ? true : r.lastHealthOk === 1,
        transport: nodemailer.createTransport({
          host: c.host, port: c.port, secure: c.secure,
          pool: c.pool ?? true, maxConnections: c.maxConnections ?? 5,
          auth: { user: c.auth_user, pass: c.auth_pass },
        }),
      };
    });
    MailService._loaded = true;
    this.ctx.logger.info(`[mail] loaded ${MailService._pool.length} providers`);
  }

  private _sortedHealthy(): ProviderEntry[] {
    return MailService._pool
      .filter((p) => p.lastHealthOk)
      .sort((a, b) => a.priority - b.priority);
  }

  private async _markUnhealthy(p: ProviderEntry) {
    p.lastHealthOk = false;
    await this.ctx.model.NotificationChannelConfig.update(
      { lastHealthOk: 0, lastHealthAt: new Date() },
      { where: { id: p.configId } },
    );
  }
}
```

测试 5 用例：
1. 单 provider 正常发送
2. 主 provider 失败 → fallback 到备
3. 所有 provider 失败 → 抛 108720
4. healthCheckAll 标记 healthy/unhealthy
5. reload 重新加载 pool

```bash
git commit -m "feat(notification): mail service multi-SMTP pool with auto failover (5 tests)"
```

---

## Task 3：健康检查 schedule

复用 P3.2 schedule 框架，新增 handler `mailHealthCheck` 每 5 分钟跑一次：

```typescript
// app/schedule/notification/mailHealthCheck.ts
import { registerScheduleHandler } from '../../service/notification-schedule';

registerScheduleHandler('mailHealthCheck', async (ctx) => {
  await ctx.service.mail.healthCheckAll();
  return { message: 'mail health check done' };
});
```

DB 迁移 025 末尾插入 schedule 行：

```sql
INSERT INTO `notification_schedules` (`code`,`name`,`handler`,`cron_expr`,`enabled`,`params`,`created_at`,`updated_at`) VALUES
  ('mail_health_check', '邮件 SMTP 健康检查', 'mailHealthCheck', '*/5 * * * *', 1, JSON_OBJECT(), NOW(), NOW())
ON DUPLICATE KEY UPDATE updated_at = NOW();
```

测试 2 用例：5 min 后 healthOk 写库 / unhealthy provider 不被选中。

```bash
git commit -m "feat(notification): schedule mail health check every 5min"
```

---

## Task 4：template 按 lang 选择 + fallback

修改 `app/service/notification-template.ts` 的 `renderByType`：

```typescript
async renderByType(input: RenderByTypeInput): Promise<RenderByTypeOutput> {
  const { ctx } = this;
  const type = await ctx.model.NotificationType.findOne({
    where: { typeKey: input.typeKey, enabled: 1 },
  });
  if (!type) ctx.throwBiz(NOTIF_ERR.TYPE_NOT_FOUND);

  // 1. 按目标 lang 找
  let template = await ctx.model.NotificationTemplate.findOne({
    where: { typeId: type.id, lang: input.lang, channel: input.channel, isActive: 1 },
  });

  // 2. fallback zh-CN
  if (!template && input.lang !== 'zh-CN') {
    template = await ctx.model.NotificationTemplate.findOne({
      where: { typeId: type.id, lang: 'zh-CN', channel: input.channel, isActive: 1 },
    });
    ctx.logger.info(`[template] fallback ${input.typeKey}/${input.channel} ${input.lang} → zh-CN`);
  }

  if (!template) ctx.throwBiz(NOTIF_ERR.I18N_TEMPLATE_MISSING);

  const { title, body } = renderTemplate(
    { titleTpl: template.titleTpl, bodyTpl: template.bodyTpl, channel: input.channel },
    input.params,
  );
  return { title, body, templateId: template.id, templateVersion: template.version };
}
```

修改 `notification.ts` 主入口：调 renderByType 时把 user.lang 传入：

```typescript
const user = await ctx.model.User.findByPk(args.userId);
const lang = user?.lang || args.lang || 'zh-CN';
const rendered = await ctx.service.notificationTemplate.renderByType({
  typeKey: args.type.typeKey, channel, lang, params: args.params,
});
```

测试 5 用例：
1. user.lang=en-US 命中 en-US 模板
2. user.lang=en-US 但无 en-US 模板 → fallback zh-CN
3. user.lang=zh-CN 命中 zh-CN
4. 显式 input.lang 优先于 user.lang
5. 所有 lang 都没有 → 抛 108723

```bash
git commit -m "feat(notification): template render i18n with zh-CN fallback (5 tests)"
```

---

## Task 5：C 端 API 用户语言偏好

新增 `PUT /api/users/me/lang`：

```typescript
router.put('/api/users/me/lang', userAuth, controller.user.updateLang);
```

controller：

```typescript
async updateLang() {
  const { ctx } = this;
  ctx.validate({
    lang: { type: 'enum', values: ['zh-CN', 'en-US'] },
  }, ctx.request.body);
  await ctx.model.User.update(
    { lang: ctx.request.body.lang },
    { where: { id: ctx.user.id } },
  );
  ctx.success();
}
```

H5/PC 端在"我的"页面增加语言切换器（小工作量）。

测试 2 用例。

```bash
git commit -m "feat(api): user language preference endpoint + h5/pc switcher"
```

---

## Task 6：admin Templates UI 增加 i18n

修改 `super-tools-admin/src/pages/Notification/Templates/index.tsx`：

1. 顶部 filter 增加 lang 下拉（zh-CN / en-US / 全部）
2. 表格 lang 列加颜色标签
3. 行操作增加"复制为其他语言"按钮：弹 Modal 选目标 lang，自动 createDraft 拷贝当前模板内容到目标 lang

`TemplateFormDrawer.tsx` 表单中 lang 字段改为下拉（zh-CN / en-US）。

```bash
git commit -m "feat(admin): templates page i18n (lang filter + copy-to-lang button)"
```

---

## Task 7：端到端联调 + 验收 + tag

### 验收 e2e

| # | 场景 | 预期 |
|---|------|------|
| 1 | 主 SMTP 正常 | 邮件发送 OK，provider=主 |
| 2 | 主 SMTP 故意配错密码 | 自动 fallback 到备；用户收到邮件 |
| 3 | 全部 SMTP 失败 | 抛 108720；BullMQ 重试 |
| 4 | 健康检查 5min 触发 | last_health_at 更新；恢复后重新可用 |
| 5 | user.lang=en-US 触发 feedback_reply（仅有 zh-CN 模板） | fallback zh-CN，不抛错 |
| 6 | admin 复制 zh-CN 到 en-US 后再触发 | 用户收到英文版本 |
| 7 | C 端 API 切换 lang | DB user.lang 更新；下次通知按新语言 |
| 8 | 不支持的 lang（如 ja-JP） | API 返回 108722 |

```bash
git tag p3-3-done
```

---

## 完成检查

- [ ] 7 Tasks 全 commit + tag
- [ ] 多 SMTP 故障转移 24 小时无异常
- [ ] self-review 已写
- [ ] 进入 [P3.4 SMS 真实接入 + 进度推送](./2026-07-11-notification-p3-4-sms-real-progress.md)
