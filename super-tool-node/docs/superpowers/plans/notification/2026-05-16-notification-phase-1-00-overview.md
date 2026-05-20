# 通知推送系统 Phase 1 实施计划（主链路打通）

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 super-tools 项目中跑通"业务调用 → 站内信入库 → Socket 实时推送 → 三端用户可见"的最小闭环。

**Architecture:** Egg.js 后端新增 BullMQ 队列 + egg-socket.io 实时推送 + 11 张通知系统数据表的核心子集；shared/notification-sdk 共享包；admin 端 Notification 模块（类型/模板/任务三大基础页面）；H5/PC 通知中心入口 + 列表页 + 偏好设置改造；3 个触发点改造（feedback 回复、auth 异常登录、verify-code 验证码）。

**Tech Stack:**
- 后端：Egg.js 3 + TypeScript 5 + Sequelize 6 + MySQL + Redis（ioredis）+ BullMQ + egg-socket.io
- 管理端：UmiJS 4 + Ant Design 5 + DVA + umi-request
- C 端：UmiJS 3 + React 16 + Zustand + socket.io-client

**Reference:** [通知推送系统模块设计需求文档（V2）](../../analysis/通知推送系统模块设计需求文档.md)

**前置条件**：已阅读需求文档第 1-7 节、第 8 节（admin 部分）、第 9 节（C 端部分）、第 10 节（SDK）、第 11 节（触发点）、第 12 节（代码规范）。

---

## Phase 1 范围（明确做与不做）

### ✅ P1 做

| 模块 | 内容 |
|------|------|
| 数据库 | 11 张表全部建（迁移 018） + 21 条预置类型 + 14 权限码 + 角色绑定 |
| 后端基础 | BullMQ 队列骨架 + egg-socket.io 配置 + JWT 鉴权中间件 |
| 后端 service | `notification.send` / `sendDirect` / `sendByAudience`（受众支持 `all` / `static` / 简单 dynamic）|
| 后端 channel | InAppAdapter（写库 + Socket emit）；EmailAdapter / SmsAdapter 占位（V1 仅打日志，下一阶段实现）|
| 后端 admin API | 类型 CRUD + 模板 CRUD + 任务创建（仅立即发送）+ 消息查询 + 我的通知 |
| 后端 C 端 API | 消息列表/未读数/标记已读/归档/偏好读写 |
| Shared SDK | REST API + Socket Client + 4 个 React Hooks |
| Admin UI | 类型管理 + 模板管理（含版本快照）+ 任务列表与立即发送向导（不含定时） + 消息记录 + 顶部铃铛 |
| H5 UI | AppHeader 加 message 入口 + notifications 列表页 + 详情页 + 偏好设置改造 |
| PC UI | Header 加铃铛 + Dropdown 面板 + notifications 列表页 + 偏好设置 |
| 触发点 | feedback.reply / auth.unusualLogin / verify-code.send（三处） |

### ❌ P1 不做（留给 P2/P3）

- 邮件真实发送（nodemailer 集成）
- 短信真实发送（仅 mock）
- 频控规则（Redis Lua 计数器）
- 静默时段判定
- 受众动态规则编辑器（admin UI）
- 任务定时/Cron 调度
- 任务暂停/取消/30 秒撤销
- 数据统计与看板
- Dashboard widget
- 模板版本回滚 UI（DB 已建版本表，但 UI 留 P2）
- 大批量任务的进度推送
- Stuck 任务恢复 schedule
- Member 到期 schedule
- alert 对接
- tool 上下架通知
- invite 成功通知
- member 升级 / 积分变动通知

> **决策原则**：P1 必须能让 "管理员发反馈回复 → 用户三端实时看到" 的完整闭环跑通；其他后置。

---

## 文件结构总览

### 后端新增/修改文件

```
super-tool-node/
├── package.json                              # 修改：新增 bullmq + egg-socket.io 依赖
├── config/
│   ├── plugin.ts                             # 修改：启用 socketIo
│   └── config.default.ts                     # 修改：新增 notification / io 配置
├── database/
│   ├── 018_add_notification_system.sql       # 新建：11 张表 + 预置数据 + 权限
│   └── 018_rollback.sql                      # 新建：回滚 SQL
├── app/
│   ├── model/
│   │   ├── notification_type.ts              # 新建
│   │   ├── notification_template.ts          # 新建
│   │   ├── notification_template_version.ts  # 新建
│   │   ├── notification_audience.ts          # 新建
│   │   ├── notification_task.ts              # 新建
│   │   ├── notification_message.ts           # 新建
│   │   ├── notification_user_preference.ts   # 新建
│   │   ├── notification_user_quiet_hours.ts  # 新建
│   │   ├── notification_rate_limit_config.ts # 新建（P1 仅模型，逻辑 P2）
│   │   ├── notification_channel_config.ts    # 新建
│   │   └── notification_send_log.ts          # 新建
│   ├── constants/
│   │   └── errorCodes.ts                     # 修改：新增 108xxx 段
│   ├── service/
│   │   ├── notification.ts                   # 新建：总入口（send/sendDirect/sendByAudience）
│   │   ├── notification-template.ts          # 新建：模板渲染
│   │   ├── notification-preference.ts        # 新建：偏好读写（P1 仅读写，无静默）
│   │   ├── notification-audience.ts          # 新建：受众解析（P1 仅 all/static）
│   │   ├── notification-channel.ts           # 新建：渠道分发
│   │   └── sms.ts                            # 修改：添加禁直调注释
│   ├── adapter/
│   │   ├── in-app.adapter.ts                 # 新建
│   │   ├── email.adapter.ts                  # 新建（P1 仅打日志 stub）
│   │   └── sms.adapter.ts                    # 新建（P1 沿用 sms.ts mock）
│   ├── controller/
│   │   ├── notification.ts                   # 新建：C 端
│   │   └── admin/
│   │       ├── notification-type.ts          # 新建
│   │       ├── notification-template.ts      # 新建
│   │       ├── notification-task.ts          # 新建
│   │       └── notification-message.ts       # 新建
│   ├── io/
│   │   ├── middleware/
│   │   │   └── notificationAuth.ts           # 新建：JWT 鉴权 + 加入房间
│   │   └── controller/
│   │       └── notification.ts               # 新建：客户端事件处理
│   ├── queue/
│   │   ├── queues.ts                         # 新建：队列定义
│   │   ├── workers/
│   │   │   └── send.worker.ts                # 新建：单条发送 worker
│   │   └── index.ts                          # 新建：启动入口
│   ├── lib/
│   │   ├── notificationEmitter.ts            # 新建：Socket 推送辅助
│   │   └── templateRenderer.ts               # 新建：模板渲染纯函数
│   └── router.ts                             # 修改：注册新路由
└── test/
    └── notification/
        ├── service/
        │   ├── notification.test.ts          # 新建
        │   ├── notification-template.test.ts # 新建
        │   └── notification-audience.test.ts # 新建
        ├── lib/
        │   └── templateRenderer.test.ts      # 新建
        ├── controller/
        │   ├── notification.test.ts          # 新建：C 端
        │   └── admin/
        │       ├── notification-type.test.ts # 新建
        │       └── notification-task.test.ts # 新建
        └── trigger/
            ├── feedback-reply.test.ts        # 新建
            ├── auth-unusual-login.test.ts    # 新建
            └── verify-code.test.ts           # 新建
```

### 共享 SDK（super-tools-web）新增文件

```
super-tools-web/
└── packages/shared/notification-sdk/         # 新建子包
    ├── package.json
    ├── src/
    │   ├── index.ts                          # 统一导出
    │   ├── types/
    │   │   ├── domain.ts
    │   │   ├── events.ts
    │   │   └── index.ts
    │   ├── api/
    │   │   ├── client.ts
    │   │   ├── messages.ts
    │   │   ├── preferences.ts
    │   │   └── index.ts
    │   ├── socket/
    │   │   ├── client.ts
    │   │   ├── reconnect.ts
    │   │   └── index.ts
    │   ├── hooks/
    │   │   ├── useUnreadCount.ts
    │   │   ├── useNotificationSocket.ts
    │   │   ├── useNotificationList.ts
    │   │   ├── usePreferences.ts
    │   │   └── index.ts
    │   ├── utils/
    │   │   ├── createSdk.ts
    │   │   └── eventBus.ts
    │   └── __tests__/
    │       ├── api.test.ts
    │       └── socket.test.ts
    └── README.md
```

### 管理端（super-tools-admin）新增/修改文件

```
super-tools-admin/
├── package.json                              # 修改：依赖 socket.io-client（如未通过 shared 引入）
├── config/routes/
│   ├── index.ts                              # 修改：引入 notification 路由
│   └── modules/
│       └── notification.ts                   # 新建
└── src/
    ├── pages/Notification/
    │   ├── _shared/
    │   │   ├── ChannelTag.tsx                # 新建
    │   │   ├── PriorityTag.tsx               # 新建
    │   │   ├── TaskStatusTag.tsx             # 新建
    │   │   ├── TypeTreeSelect.tsx            # 新建
    │   │   ├── permCodes.ts                  # 新建
    │   │   └── statusMaps.ts                 # 新建
    │   ├── Types/
    │   │   ├── index.tsx                     # 新建
    │   │   ├── TypeFormModal.tsx             # 新建
    │   │   └── TypeDetailDrawer.tsx          # 新建
    │   ├── Templates/
    │   │   ├── index.tsx                     # 新建
    │   │   ├── TemplateFormDrawer.tsx        # 新建
    │   │   ├── TemplatePreviewModal.tsx      # 新建
    │   │   └── TemplateTestSendModal.tsx     # 新建
    │   ├── Tasks/
    │   │   ├── index.tsx                     # 新建
    │   │   ├── CreateTaskWizard.tsx          # 新建（P1 仅立即发送 4 步向导）
    │   │   └── TaskDetailDrawer.tsx          # 新建
    │   ├── Messages/
    │   │   ├── index.tsx                     # 新建
    │   │   └── MessageDetailDrawer.tsx       # 新建
    │   └── MyNotifications/
    │       └── index.tsx                     # 新建：管理员"我的通知"
    ├── services/
    │   └── notification.ts                   # 新建：API 封装
    └── components/
        └── NotificationBell/
            ├── index.tsx                     # 新建
            └── NotificationPanel.tsx         # 新建
```

### H5 端（packages/h5/micro-tools）新增/修改文件

```
packages/h5/micro-tools/
├── package.json                              # 修改：依赖 socket.io-client
├── routes.config.ts                          # 修改：增加 /notifications 路由
├── components/AppHeader/
│   ├── index.tsx                             # 修改：扩展 type='message'
│   └── types.ts                              # 修改：HeaderButtonType 联合类型加 'message'
├── pages/notifications/
│   ├── index.tsx                             # 新建：消息中心列表
│   └── detail/[id].tsx                       # 新建：消息详情
├── pages/settings/notification/
│   └── index.tsx                             # 改造：对接新 API
├── store/
│   └── notification.ts                       # 新建：未读数 store
└── layouts/
    └── index.tsx                             # 修改：初始化 SDK
```

### PC 端（packages/pc/tool-box）新增/修改文件

```
packages/pc/tool-box/
├── package.json                              # 修改：依赖 socket.io-client
├── .umirc.ts                                 # 修改：增加 /notifications 路由
├── components/
│   ├── Header/
│   │   └── index.tsx                         # 修改：右侧增加 NotificationDropdown
│   └── NotificationDropdown/
│       ├── index.tsx                         # 新建
│       └── NotificationPanel.tsx             # 新建
├── pages/notifications/
│   ├── index.tsx                             # 新建
│   └── preferences.tsx                       # 新建：偏好设置
├── store/
│   └── notification.ts                       # 新建
└── layouts/BasicLayout/
    └── index.tsx                             # 修改：初始化 SDK
```

---

## Phase 1 任务列表（22 个 Task）

> **执行顺序**：Task 1 → Task 22 严格按编号执行。Task 之间存在依赖（如 Task 5 模型依赖 Task 4 迁移）。
> **Commit 策略**：每个 Task 完成后单独 commit；Task 内多步骤一次性 commit（除非任务说明另有指示）。

### Task 概览

| # | 任务 | 工程量 | 依赖 |
|---|------|-------|------|
| 1 | 后端：新增依赖 + 配置 + plugin 启用 | S | - |
| 2 | 后端：错误码扩展 | S | 1 |
| 3 | 后端：模板渲染纯函数 + 单元测试 | S | 1 |
| 4 | 后端：DB 迁移 018（11 表 + 预置 + 权限） | M | 1 |
| 5 | 后端：11 个 Sequelize Model | M | 4 |
| 6 | 后端：notification-template service + 测试 | M | 5, 3 |
| 7 | 后端：notification-preference service + 测试 | S | 5 |
| 8 | 后端：notification-audience service（仅 all/static） + 测试 | S | 5 |
| 9 | 后端：BullMQ 队列骨架 + send worker | M | 1, 5 |
| 10 | 后端：渠道适配器（InApp 完整 + Email/Sms stub） | M | 5, 9 |
| 11 | 后端：notification.send 主入口 + 测试 | M | 6, 7, 8, 10 |
| 12 | 后端：Socket.IO 配置 + 鉴权中间件 + io controller | M | 1 |
| 13 | 后端：admin API（类型 + 模板 CRUD） | M | 5, 6 |
| 14 | 后端：admin API（任务创建立即发送 + 消息查询） | M | 11, 13 |
| 15 | 后端：C 端 API（消息列表/未读数/已读/偏好） | M | 5, 7 |
| 16 | 后端：触发点改造（feedback / auth / verify-code） | M | 11 |
| 17 | Shared SDK：types + api + socket + hooks + 测试 | L | 12, 15 |
| 18 | Admin：路由 + permCodes + Notification 模块页面 | L | 13, 14 |
| 19 | Admin：顶部铃铛 + 我的通知页面 + 多端登录验证 | M | 17, 18 |
| 20 | H5：AppHeader 改造 + 消息中心页 + 偏好页 + SDK 接入 | L | 17 |
| 21 | PC：Header 改造 + 铃铛面板 + 消息中心 + SDK 接入 | L | 17 |
| 22 | 端到端联调 + P1 验收门禁清单逐项验证 | M | 16-21 |

> **总计**：22 任务，估算 ~3 周（1 后端 + 1 前端 admin + 0.5 前端 h5/pc）。

---

## 子文件索引（详细任务分文件存放）

> 由于 P1 计划较长（每个 Task 包含完整测试代码 + 实现代码 + 验证步骤），按 Task 数量拆分为 12 个子文件。**请按编号顺序阅读和执行**。

| 子文件 | Task | 主要交付物 |
|--------|------|-----------|
| [`p1-01-deps-config.md`](./p1-01-deps-config.md) | **T1** | 依赖 + plugin 启用 + config 配置 |
| [`p1-02-errcodes.md`](./p1-02-errcodes.md) | **T2** | 108xxx 错误码 |
| [`p1-03-renderer.md`](./p1-03-renderer.md) | **T3** | 模板渲染纯函数 + 单元测试 |
| [`p1-04-migration.md`](./p1-04-migration.md) | **T4** | DB 迁移 018（11 表 + 21 类型 + 14 权限） |
| [`p1-05-models.md`](./p1-05-models.md) | **T5** | 11 个 Sequelize Model |
| [`p1-06-services-template-pref-audience.md`](./p1-06-services-template-pref-audience.md) | **T6-T8** | template / preference / audience service |
| [`p1-07-queue-channel.md`](./p1-07-queue-channel.md) | **T9-T10** | BullMQ 队列骨架 + 渠道适配器 |
| [`p1-08-send-main.md`](./p1-08-send-main.md) | **T11** | `notification.send` 主入口 + 完整测试 |
| [`p1-09-socket-admin-api-1.md`](./p1-09-socket-admin-api-1.md) | **T12-T13** | Socket.IO 鉴权 + admin 类型/模板 API |
| [`p1-10-admin-cend-trigger.md`](./p1-10-admin-cend-trigger.md) | **T14-T16** | admin 任务+消息 / C 端 API / 三触发点改造 |
| [`p1-11-sdk.md`](./p1-11-sdk.md) | **T17** | shared/notification-sdk 全套 |
| [`p1-12-frontend-acceptance.md`](./p1-12-frontend-acceptance.md) | **T18-T22** | admin 页面 / H5 / PC / 联调验收 |

### 子文件依赖关系

```
01-deps → 02-errcodes → 03-renderer ─┐
                                     │
                       04-migration ─┤
                                     ↓
                       05-models ────────────────────────────────┐
                                                                 ↓
06-services (T6-8) ──────────────────────────────────────► 08-send-main (T11)
                                                                 │
                                07-queue-channel (T9-10) ───────►┤
                                                                 ↓
                                                        09-socket-admin-api (T12-13)
                                                                 │
                                                                 ↓
                                                        10-admin-cend-trigger (T14-16)
                                                                 │
                                                                 ↓
                                                        11-sdk (T17)
                                                                 │
                                                                 ↓
                                                        12-frontend-acceptance (T18-22)
```

> 严格按编号执行；每个子文件内 Task 也按编号顺序执行。每个 Task 的 commit 单独提交，便于回滚。

### 测试策略（全 P1 阶段统一）

- 后端单元测试：`egg-mock` + `jest`（项目已配置）
- 后端 e2e：`egg-mock` 拉起完整 app 走 supertest
- SDK 单元测试：`jest` + `msw`（mock server worker）
- 前端 UI：仅 hooks 单测覆盖；页面交互由 Task 22 端到端联调清单验证

### Commit 规范（全 P1 阶段统一）

每个 Task 完成后单独 commit，message 格式：

```
feat(notification): <task summary in english>

<optional body explaining what / why>

Refs: docs/analysis/通知推送系统模块设计需求文档.md (V2 §X.Y)
```

---

## Self-Review 备忘

> writing-plans 技能要求：写完计划后做 spec coverage / placeholder scan / type consistency 自检。
> P1 计划完成后，请执行以下自检：
> 1. **Spec coverage**：对照需求文档第 14.2.1 P0 功能清单，确认每条都有对应 Task
> 2. **Placeholder scan**：grep 计划文件中的 `TBD` / `TODO` / "如有需要" / "待补充"
> 3. **Type consistency**：API 入参类型、错误码常量名在 Task 之间应一致
> 4. **依赖闭环**：所有 Task 依赖关系应能拓扑排序无环

自检结果写入 [`2026-05-16-notification-phase-1-self-review.md`](./2026-05-16-notification-phase-1-self-review.md)（P1 完成后再写）。

---
