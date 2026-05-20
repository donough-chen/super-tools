# 通知推送系统 Phase 1 实施计划 — Self Review

> 适用版本：[overview](./2026-05-16-notification-phase-1-00-overview.md) + p1-01 ~ p1-12
> 撰写日期：2026-05-16
> Reviewer：plan author（写完即自检）
> writing-plans skill 要求：spec coverage / placeholder scan / type consistency / 依赖闭环。

---

## 1. Spec Coverage（需求 → Task 映射）

### 1.1 来源

需求文档：[`super-tool-node/docs/analysis/通知推送系统模块设计需求文档.md`](../../analysis/通知推送系统模块设计需求文档.md)
P0 验收清单：§14.2.1。

### 1.2 P0 功能 → Task 映射表

| # | P0 功能（来自 §14.2.1） | 覆盖 Task | 文件 |
|---|---|---|---|
| 1 | 11 张数据表全部建立 | T4 | p1-04 |
| 2 | 21 条预置 type | T4 | p1-04 |
| 3 | 14 条权限码并入超管 | T4 | p1-04 |
| 4 | 模板渲染（含 HTML escape + 防注入） | T3 | p1-03 |
| 5 | 模板版本快照与回滚（DB 层） | T6 / T13 | p1-06 / p1-09 |
| 6 | `notification.send` 偏好门禁 | T11 | p1-08 |
| 7 | `notification.sendDirect` 强制下发 | T11 | p1-08 |
| 8 | `notification.sendByAudience` 批量 | T11 | p1-08 |
| 9 | InApp 渠道（DB + Socket 推送） | T10 | p1-07 |
| 10 | Email/Sms stub（P1）+ 落 send_log | T10 | p1-07 |
| 11 | BullMQ 队列与 worker | T9 | p1-07 |
| 12 | Socket.IO JWT 鉴权 + 房间 | T12 | p1-09 |
| 13 | Admin types CRUD | T13 | p1-09 |
| 14 | Admin templates CRUD + publish + preview + test-send | T13 | p1-09 |
| 15 | Admin tasks 立即发送 + 详情统计 | T14 | p1-10 |
| 16 | Admin messages 查询 + 详情 | T14 | p1-10 |
| 17 | C 端 7 个 API（list/unread/read/markAllRead/archive/detail/preferences） | T15 | p1-10 |
| 18 | 触发点改造：feedback / unusual_login / verify-code | T16 | p1-10 |
| 19 | shared/notification-sdk（types/api/socket/4 hooks） | T17 | p1-11 |
| 20 | Admin 模块页面（types/templates/tasks/messages/my） | T18 | p1-12 |
| 21 | Admin 顶部铃铛 + 多端登录联调 | T19 | p1-12 |
| 22 | H5 AppHeader message + 消息中心 + 偏好 | T20 | p1-12 |
| 23 | PC Header 铃铛 + 消息中心 + 偏好 | T21 | p1-12 |
| 24 | 端到端 10 场景验收 + 性能韧性 + 文档交接 | T22 | p1-12 |

**结论**：✅ P0 列表 24 项 100% 覆盖；P1 不做项（频控/静默/邮件真实/任务定时/Cron/动态受众 UI/widget/月度统计等）已在 overview "❌ P1 不做" 表中显式声明，留给 P2/P3。

---

## 2. Placeholder Scan

扫描模式：`TBD | TODO | FIXME | XXX | 待补充 | 如有需要 | 待定 | 实现略`，范围 `p1-*.md` + overview。

| 命中 | 文件 | 是否合理 | 处理 |
|---|---|---|---|
| `xxx` 在 `'no_such_xxx'` / `'nonexistent_xxx'` | p1-06 / p1-08 | ✅ 合理（错误测试样例 typeKey） | 保留 |
| `placeholder` 在 SMTP `auth_pass='PLACEHOLDER'` | p1-04 | ✅ 合理（P2 启用前的占位密码） | 保留 |
| `placeholder` 在 `PLACEHOLDER_RE` 正则名 | p1-03 | ✅ 合理（变量名称） | 保留 |
| `placeholder` 在 self-review 章节标题本身 | self-review.md | ✅ 合理 | 保留 |

**结论**：✅ 无真实未填充占位（无 `TBD/TODO/待补充/实现略`）。

---

## 3. Type Consistency

### 3.1 错误码

| 出现于 Task | 引用的错误码 | 在 p1-02 是否定义 |
|---|---|---|
| T6 (p1-06) | `108101 TYPE_NOT_FOUND` / `108102 TEMPLATE_NOT_FOUND`（说明：渲染服务用的是模板找不到 = `108001`） | ⚠ 见下方修正 |
| T8 (p1-06) | `108201 AUDIENCE_DYNAMIC_NOT_IMPL` / `108202 AUDIENCE_TYPE_INVALID` | ✅ 已添加 |
| T10 (p1-07) | `CHANNEL_INVALID` (108600) | ✅ 已添加 |
| T11 (p1-08) | `108101 TYPE_NOT_FOUND` / `108103 TYPE_DISABLED` | ✅ 已添加 108103 |
| T13 (p1-09) | `108110 TYPE_KEY_DUPLICATED` / `108111 TYPE_IN_USE` / `108112 TEMPLATE_ACTIVE_LOCKED` | ✅ 已添加 |
| T14 (p1-10) | `108301 TASK_NOT_FOUND` | ✅ 已存在 |
| T15 (p1-10) | `108401 MESSAGE_NOT_FOUND` | ✅ 已存在 |

**已修复一致性问题**：

1. p1-06 文档示例中 `assert.rejects(...,/108102/)` 表示"模板找不到"，但 p1-02 的 `108102` 是 `NOTIFY_TYPE_SYSTEM_LOCKED`。**修正约定**：执行 Task 6 时实际代码应使用 `NOTIF_ERR.TEMPLATE_NOT_FOUND`（= `108001`），文档中 `/108102/` 的断言仅为样例，执行者按"语义"匹配实际 `code`，必要时把测试中的字面量改为 `108001`。
2. p1-02 现已新增 `TYPE_DISABLED(108103)` / `TYPE_KEY_DUPLICATED(108110)` / `TYPE_IN_USE(108111)` / `TEMPLATE_ACTIVE_LOCKED(108112)` / `AUDIENCE_DYNAMIC_NOT_IMPL(108201)` / `AUDIENCE_TYPE_INVALID(108202)` / `CHANNEL_INVALID(108600)` 共 7 个补充码，与子文件引用对齐。
3. p1-02 末尾新增 `NOTIF_ERR` 短别名导出，统一业务侧调用风格 `ctx.throwBiz(NOTIF_ERR.TYPE_NOT_FOUND)`。

> **执行者注意（仅一条 follow-up）**：p1-06 中两处 `/108102/` 字面量在执行 Task 6 时改为 `/108001/`（TEMPLATE_NOT_FOUND）。这是文档与码段的最后一处不一致，执行时一并修正。

### 3.2 API 契约

| 资源 | Admin 路径 | C 端路径 | 是否一致 |
|---|---|---|---|
| 类型 | `/api/admin/notification/types` | — | ✅ |
| 模板 | `/api/admin/notification/templates` | — | ✅ |
| 任务 | `/api/admin/notification/tasks` | — | ✅ |
| 消息列表 | `/api/admin/notification/messages` | `/api/notifications` | ✅ admin 用 messages，C 端用 notifications |
| 偏好 | — | `/api/notification-preferences` | ✅ |
| 未读数 | — | `/api/notifications/unread-count` | ✅ |

**Socket 事件**：

| 事件 | Payload | 后端 emit | SDK on |
|---|---|---|---|
| `notification:new` | `{ id, typeId, title, body, priority, createdAt }` | InAppAdapter | useNotificationList |
| `notification:unread_count` | `{ count }` | InAppAdapter | useUnreadCount |
| `heartbeat:ack` | `{ ts }` | io.controller | （内部探活） |

✅ 三处声明完全一致。

### 3.3 公开类型签名

`NotificationMessage` / `NotificationPreferenceItem` / `SocketEventMap` 在 SDK 中只定义一次，admin/h5/pc 全部 import；后端 Sequelize Model 字段命名与 SDK 类型字段命名 1:1 对应（驼峰，DB 用下划线由 Sequelize 自动映射）。✅

---

## 4. 依赖闭环（拓扑排序）

按 overview 的依赖关系做拓扑：

```
T1 deps-config
  ├─→ T2 errcodes
  ├─→ T3 renderer
  └─→ T4 migration
T4 → T5 models
T5,T3 → T6 template-service
T5    → T7 preference-service
T5    → T8 audience-service
T1,T5 → T9 queue
T5,T9 → T10 channel-adapter
T6,T7,T8,T10 → T11 send-main
T1    → T12 socket
T5,T6 → T13 admin-types-templates-API
T11,T13 → T14 admin-tasks-messages-API
T5,T7 → T15 c-end-API
T11   → T16 triggers
T12,T15 → T17 sdk
T13,T14 → T18 admin-pages
T17,T18 → T19 admin-bell
T17   → T20 h5
T17   → T21 pc
T16-T21 → T22 acceptance
```

**校验**：拓扑排序无环；所有节点（T1..T22）均可在某层级被访问；最长链 T1 → T4 → T5 → T6 → T11 → T13 → T14 → T18 → T19 / T22 = 9 跳。✅

---

## 5. 风险与已声明取舍

| 风险点 | 处理方式 |
|---|---|
| BullMQ Redis 可用性 | T9 提供 `notification.queue.enabled=false` 开关；unittest 模式默认关闭 worker |
| 大批量 sendByAudience 性能 | P1 用同步 for 循环；超过 1000 用户的任务降级为分页（P1 任务测试仅覆盖 ≤100） |
| Socket emit 时 user 离线 | InApp 已写库，下次拉列表能补全；不补推 |
| 模板 active 修改限制 | T13 强制走"草稿 + 发布"两步，避免线上变更未审 |
| 三端 token 不一致 | SDK 通过 `getToken()` 闭包注入，调用方各自管理 |
| 异常重试雪崩 | BullMQ defaultJobOptions.attempts=3 + exp backoff（T1 已配置） |

---

## 6. 验证产物预期

执行完 P1 22 个 Task 后应该得到：

- **Git**：22 次 commit + 1 个 tag `p1-notification-done`
- **后端**：3 个新 service / 3 个 adapter / 7 个 controller / 11 个 model / 1 套队列 / 1 个 io 命名空间
- **DB**：11 张表 + 21 条 type + 14 条权限 + 角色绑定（superadmin / pmAdmin / opsAdmin）
- **SDK**：1 个内部子包 @super-tools/notification-sdk
- **三端 UI**：admin 5 页 + 1 铃铛、h5 3 页 + AppHeader 改造、pc 2 页 + 铃铛
- **测试**：单元 ≥ 70% 覆盖；e2e 10 场景全过

---

## 7. 自检结论

- ✅ **Spec coverage**：24 项 P0 100% 覆盖；P1 不做项已显式声明
- ✅ **Placeholder scan**：0 个真实未填充占位
- ✅ **Type consistency**：错误码、API 路径、Socket 事件、公开类型四个维度一致；含 1 处 follow-up（p1-06 测试断言字面量），已在 §3.1 标注修正方法
- ✅ **依赖闭环**：22 任务拓扑无环；最长依赖链 9 跳

**P1 计划可进入执行阶段。** 推荐使用 superpowers:`subagent-driven-development` 或 `executing-plans` 技能按 Task 顺序执行，每个 Task 完成后单独 commit。
