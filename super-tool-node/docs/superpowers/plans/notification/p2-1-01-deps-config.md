# P2.1-01：依赖 + config + 错误码 message 实装（Task 1）

> 父计划：[2026-05-23-notification-p2-1-rate-quiet-mail.md](./2026-05-23-notification-p2-1-rate-quiet-mail.md)
> 包含：Task 1（依赖+config+错误码）

---

## Step 1: 添加 nodemailer 依赖

- [ ] 安装

```bash
cd super-tool-node
npm i nodemailer@^6.9.0
npm i -D @types/nodemailer@^6.4.0
```

预期：`package.json` 出现 `nodemailer ^6.9.0`，`@types/nodemailer ^6.4.0`。

---

## Step 2: 修改 `config/config.default.ts`，扩展 notification 配置

- [ ] 在 `config.notification` 节点追加（保留 P1 已有内容）：

```typescript
config.notification = {
  ...config.notification, // P1 保留：queue / io / templateLang ...

  rateLimit: {
    enabled: true,
    redisKeyPrefix: 'notif:rl:', // 拼接：notif:rl:user:{uid}:type:{tid}:{win}
    /** 默认窗口规则；admin 可在 notification_rate_limit_config 表覆盖 */
    defaults: {
      perUserPerType: { window: 60,   max: 10   }, // 60s 同类型 10 条
      perUserGlobal:  { window: 3600, max: 50   }, // 1h 全量 50 条
      perGlobal:      { window: 60,   max: 5000 }, // 全站 60s 5000 条
    },
  },

  quietHours: {
    enabled: true,
    defaultTimezone: 'Asia/Shanghai',
  },

  mail: {
    enabled: true,
    from: '"super-tools" <noreply@super-tools.local>',
    /** 启动时优先读 notification_channel_config 表 isDefault=1 的配置；本块仅 fallback */
    transport: {
      host: 'smtp.example.com',
      port: 587,
      secure: false,
      pool: true,
      maxConnections: 5,
      maxMessages: 100,
      auth: { user: 'noreply@example.com', pass: 'CHANGE_IN_PROD' },
    },
  },

  frontend: {
    h5BaseUrl: process.env.H5_BASE_URL || 'https://m.super-tools.local',
    pcBaseUrl: process.env.PC_BASE_URL || 'https://www.super-tools.local',
  },
};
```

---

## Step 3: 修改 `app/constants/errorCodes.ts`

- [ ] 确认 P1 留下的占位码（应均已存在），并核对其 `message` 与本计划一致；如不一致请修正：

```typescript
NOTIFY_SKIP_RATE_LIMITED: { code: 108502, message: '命中频控限制，跳过发送' },
NOTIFY_SKIP_QUIET_HOUR:   { code: 108503, message: '命中静默时段，跳过发送' },
NOTIFY_EMAIL_SEND_FAILED: { code: 108602, message: '邮件发送失败' },
```

> 这三个常量 P1 已添加；本步仅核对 message。如发现拼写不同请就地修改。

- [ ] `NOTIF_ERR` 短别名段补三条对应映射（如已存在则跳过）：

```typescript
SKIP_RATE_LIMITED: ErrorCodes.NOTIFY_SKIP_RATE_LIMITED,
SKIP_QUIET_HOUR:   ErrorCodes.NOTIFY_SKIP_QUIET_HOUR,
EMAIL_SEND_FAILED: ErrorCodes.NOTIFY_EMAIL_SEND_FAILED,
```

---

## Step 4: 验证

- [ ] `npm run lint` 0 错误
- [ ] `node -e "console.log(require('nodemailer').version)"` 输出 `6.9.x`
- [ ] `node -e "console.log(require('./app/constants/errorCodes').NOTIF_ERR.SKIP_RATE_LIMITED)"`（如有 ts-node 则用 ts-node；否则 lint 通过即可视为类型正确）

---

## Step 5: Commit

```bash
git add super-tool-node/package.json super-tool-node/package-lock.json super-tool-node/config/config.default.ts super-tool-node/app/constants/errorCodes.ts
git commit -m "feat(notification): add p2.1 deps (nodemailer) and config (rateLimit/quietHours/mail)

Refs: docs/analysis/通知推送系统模块设计需求文档.md (V2 §7)
Plan: docs/superpowers/plans/2026-05-23-notification-p2-1-rate-quiet-mail.md (Task 1)"
```

---

## Verification Checklist

- [ ] `package.json` 含 `nodemailer ^6.9.x`
- [ ] `config.notification.rateLimit / quietHours / mail / frontend` 四个新节均存在
- [ ] `errorCodes.ts` 中 3 个 `NOTIFY_*` 码 message 正确
- [ ] `npm run lint` 通过
- [ ] commit 已提交

完成后进入 [`p2-1-02-migration.md`](./p2-1-02-migration.md)。
