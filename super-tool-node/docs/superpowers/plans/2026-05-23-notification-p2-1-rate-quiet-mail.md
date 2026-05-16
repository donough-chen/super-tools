# P2.1 实施计划：频控 + 静默时段 + 邮件真实发送（总览）

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement each Task by sub-file.

**Goal:** 在 P1 已打通的"业务调用 → 队列 → 渠道适配器"主链路上挂入三层防骚扰能力（用户偏好已在 P1 / 静默时段 / 频控）+ 替换 P1 的 EmailAdapter stub 为 nodemailer 真实实现。

**Architecture:**
- send 主入口插入"静默 → 频控"两层短路检查（顺序固定，命中后短路返回 `108502/108503`）
- 频控用 Redis Lua 三层（user/type/global/channel）原子计数器，TTL 自动过期
- 静默用 user_quiet_hours 表 + 类型级 `quietHourPolicy` 字段（respect/bypass/relax）
- EmailAdapter：nodemailer SMTP pool + HTML 包装 + 失败重试 3 次（BullMQ defaultJobOptions.attempts）

**Tech Stack:**
- 后端：Egg.js 3 + nodemailer 6 + ioredis Lua + 现有 BullMQ
- Admin：UmiJS 4 + Ant Design 5 新增 2 个配置页面（频控规则 / 渠道服务商）

**Reference:** [通知推送系统模块设计需求文档（V2）](../../analysis/通知推送系统模块设计需求文档.md) §7

**前置条件**：P1 已合入 master，tag `p1-notification-done` 存在；阅读需求文档 §7（频控/静默/优先级矩阵）、§7.3（Redis Key 与 Lua）、§5.4（DB 表 9）。

---

## 范围（明确做与不做）

### ✅ 做

| 模块 | 内容 |
|------|------|
| DB 迁移 019 | 完善 `notification_rate_limit_config` 字段 + 类型级 `quietHourPolicy` + `notification_channel_config` SMTP 字段 + send_logs.message_id NULLABLE |
| 后端 service | `notification-rate-limit` (Redis Lua)；`notification-quiet-hours` (时区计算)；`mail.ts` (nodemailer 封装) |
| 后端 send 改造 | `notification.send` 在 channel 分发前插入 quiet → rate 两层检查；命中时写 `notification_send_logs` skipped 行 |
| EmailAdapter | 替换 P1 stub：渲染 HTML → 调 mail.ts → 写 send_log（含 messageId / providerResp） |
| Admin UI | `Notification/Configs/RateLimit` 频控规则 CRUD 页 + `Notification/Configs/Channels` 渠道服务商页（含 SMTP 测试按钮） |
| 单测覆盖 | 频控 12 用例；静默 8 用例；邮件 6 用例 + 集成 3 用例 |

### ❌ 不做（留 P2.2 / P2.3 / P2.4 / P3）

- 任务定时 / Cron / RRULE（P2.2）
- 动态受众规则编辑器（P2.3）
- 多 SMTP 自动切换（P3）
- 短信真实接入（沿用 P1 stub）
- 模板版本回滚 UI（P2.4）

---

## 文件结构总览

### 后端

```
super-tool-node/
├── package.json                               # 修改：+nodemailer ^6.x
├── config/config.default.ts                   # 修改：+notification.{rateLimit,quietHours,mail}
├── database/
│   ├── 019_p2_rate_quiet_mail.sql             # 新建
│   └── 019_rollback.sql                       # 新建
├── app/
│   ├── constants/errorCodes.ts                # 修改：实装 108502/108503/108602
│   ├── service/
│   │   ├── notification-rate-limit.ts         # 新建
│   │   ├── notification-quiet-hours.ts        # 新建
│   │   ├── notification.ts                    # 修改：插入 quiet→rate 检查
│   │   └── mail.ts                            # 新建
│   ├── adapter/email.adapter.ts               # 修改：替换 stub
│   ├── lib/
│   │   ├── rateLimitLua.ts                    # 新建
│   │   └── htmlEmailRenderer.ts               # 新建
│   ├── controller/admin/
│   │   ├── notification-rate-limit.ts         # 新建
│   │   └── notification-channel.ts            # 新建
│   └── router.ts                              # 修改：注册新路由
└── test/notification/
    ├── service/
    │   ├── notification-rate-limit.test.ts    # 12 用例
    │   ├── notification-quiet-hours.test.ts   # 8 用例
    │   ├── mail.test.ts                       # 6 用例
    │   └── notification-send-with-rate.test.ts# 3 集成用例
    └── controller/admin/
        ├── notification-rate-limit.test.ts
        └── notification-channel.test.ts
```

### 管理端

```
super-tools-admin/
├── config/routes/modules/notification.ts      # 修改：+/configs/rate-limit /configs/channels
└── src/pages/Notification/Configs/
    ├── RateLimit/
    │   ├── index.tsx
    │   └── RuleFormModal.tsx
    └── Channels/
        ├── index.tsx
        ├── ChannelFormDrawer.tsx
        └── SmtpTestButton.tsx
```

---

## 任务列表（10 Task，分 8 个子文件）

| # | Task | 子文件 | 工程量 | 依赖 |
|---|------|--------|-------|------|
| 1 | 依赖 + config + 错误码 | [`p2-1-01-deps-config.md`](./p2-1-01-deps-config.md) | S | - |
| 2 | DB 迁移 019 + Model | [`p2-1-02-migration.md`](./p2-1-02-migration.md) | M | 1 |
| 3 | quiet-hours service + 测试 | [`p2-1-03-quiet-hours.md`](./p2-1-03-quiet-hours.md) | M | 2 |
| 4 | rate-limit service + Lua + 测试 | [`p2-1-04-rate-limit.md`](./p2-1-04-rate-limit.md) | L | 2 |
| 5 | mail.ts + 测试 | [`p2-1-05-mail-service.md`](./p2-1-05-mail-service.md) | M | 1 |
| 6 | EmailAdapter 真实化 + html renderer | [`p2-1-06-email-adapter.md`](./p2-1-06-email-adapter.md) | M | 5 |
| 7 | send 主链路插入 quiet→rate 集成 | [`p2-1-07-send-integration.md`](./p2-1-07-send-integration.md) | M | 3, 4 |
| 8 | admin API（rate-limit / channel） | [`p2-1-08-admin-api.md`](./p2-1-08-admin-api.md) | M | 4, 6 |
| 9 | Admin UI（RateLimit / Channels） | [`p2-1-09-admin-ui.md`](./p2-1-09-admin-ui.md) | M | 8 |
| 10 | 端到端联调 + P2.1 验收门禁 | [`p2-1-10-acceptance.md`](./p2-1-10-acceptance.md) | M | 1-9 |

### 子文件依赖关系图

```
01-deps → 02-migration ─┬─► 03-quiet-hours ─┐
                        │                   │
                        ├─► 04-rate-limit ──┤
                        │                   ↓
01-deps → 05-mail ─► 06-email-adapter      07-send-integration
                                                     │
                          ┌──────────── 08-admin-api ┤
                          │                          ↓
                          └─► 09-admin-ui ──────► 10-acceptance
```

> 严格按编号执行；每个子文件内 Step 也按顺序执行；每 Task 单独 commit。

---

## P2.1 共享前提

- **Commit 规范**：

  ```
  feat(notification): <task summary>

  Refs: docs/analysis/通知推送系统模块设计需求文档.md (V2 §X.Y)
  Plan: docs/superpowers/plans/2026-05-23-notification-p2-1-rate-quiet-mail.md (Task N)
  ```

- **测试**：每个 service 单测在写实现前先编写并验证 fail，再写实现验证 pass（TDD）。

- **错误码使用**：

  ```ts
  ctx.throwBiz(NOTIF_ERR.SKIP_RATE_LIMITED);    // 108502
  ctx.throwBiz(NOTIF_ERR.SKIP_QUIET_HOUR);      // 108503
  ctx.throwBiz(NOTIF_ERR.EMAIL_SEND_FAILED);    // 108602
  ```

- **回滚策略**：迁移 019 必须能在干净库 up + rollback 来回多次成功。

---

## Self-Review 备忘

P2.1 全部 Task 完成后，写 [`2026-05-23-notification-p2-1-self-review.md`](./2026-05-23-notification-p2-1-self-review.md)，检查：

1. **Spec coverage**：需求 §7（频控/静默/优先级矩阵）的 §7.1~§7.5 每个子节都有对应 Task
2. **Placeholder scan**：grep `TBD/TODO/FIXME/待补充/实现略`，应 0 命中
3. **Type consistency**：错误码 / `RateRule` 接口 / `QuietRule` 字段 / Mail 配置 schema 在 Task 间一致
4. **依赖闭环**：上方依赖图无环
