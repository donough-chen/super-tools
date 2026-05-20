# 通知推送系统完整实施计划（P1 + P2 + P3 汇总）

> **文档说明**：本文件是对 plans 目录下所有通知推送系统相关计划文档的统一整理与合并，涵盖 Phase 1（主链路打通）、Phase 2（多渠道 + 防骚扰）、Phase 3（高级运营）三个阶段共 **30 个子计划文件**的核心内容。
>
> **需求来源**：[通知推送系统模块设计需求文档（V2）](../../analysis/通知推送系统模块设计需求文档.md)
>
> **执行方式**：REQUIRED SUB-SKILL: `superpowers:subagent-driven-development` 或 `superpowers:executing-plans`

---

## 目录

1. [项目概览](#一项目概览)
2. [Phase 1：主链路打通](#二phase-1主链路打通)
3. [Phase 2：多渠道 + 防骚扰](#三phase-2多渠道--防骚扰)
4. [Phase 3：高级运营](#四phase-3高级运营)
5. [全局约定](#五全局约定)
6. [子文件索引](#六子文件索引)
7. [整体验收门禁](#七整体验收门禁)

---

## 一、项目概览

### 1.1 目标

构建一个**务实可落地**的通知推送系统，覆盖：

- **三渠道**：站内信（in_app）+ 邮件（email）+ 短信（sms）
- **三端**：admin 管理端 / H5 / PC
- **核心能力**：模板管理 · 受众分组 · 任务调度 · 频控/静默 · 实时推送 · 数据看板

### 1.2 技术栈

| 层       | 技术                                                                                     |
| -------- | ---------------------------------------------------------------------------------------- |
| 后端     | Egg.js 3 + TypeScript 5 + Sequelize 6 + MySQL + Redis（ioredis）+ BullMQ + egg-socket.io |
| 管理端   | UmiJS 4 + Ant Design 5 + DVA + umi-request                                               |
| C 端     | UmiJS 3 + React 16 + Zustand + socket.io-client                                          |
| 共享 SDK | packages/shared/notification-sdk                                                         |

### 1.3 阶段总览

| 阶段     | 周期 | 核心目标                                     | 完成 Tag                |
| -------- | ---- | -------------------------------------------- | ----------------------- |
| **P1**   | 3 周 | 主链路打通（站内信 + Socket 实时推送）       | `p1-notification-done`  |
| **P2.1** | W4   | 频控 + 静默时段 + 邮件真实发送               | `p2-1-done`             |
| **P2.2** | W5   | 任务定时/Cron/RRULE + 生命周期管理           | `p2-2-done`             |
| **P2.3** | W6   | 动态受众规则引擎 + admin 可视化编辑器        | `p2-3-done`             |
| **P2.4** | W7   | 新触发点 + 模板版本回滚 UI                   | `p2-4-done` / `p2-done` |
| **P3.1** | W8   | Stats 数据看板 + Dashboard widget + 异步导出 | `p3-1-done`             |
| **P3.2** | W9   | Member 到期 schedule + 数据清理 + alert 对接 | `p3-2-done`             |
| **P3.3** | W10  | 多 SMTP 自动切换 + 模板 i18n                 | `p3-3-done`             |
| **P3.4** | W11  | 短信真实接入 + 大任务进度推送 + 队列监控     | `p3-4-done` / `p3-done` |

### 1.4 数据库迁移编号

| 迁移 | 阶段 | 内容                                                 |
| ---- | ---- | ---------------------------------------------------- |
| 018  | P1   | 11 张核心表 + 21 类型 + 14 权限码                    |
| 019  | P2.1 | 频控/静默/邮件配置字段完善                           |
| 020  | P2.2 | task 表新增 8 个调度字段                             |
| 021  | P2.3 | notification_audiences 表 + 受众权限码               |
| 022  | P2.4 | 5 个业务类型 + 模板 seed                             |
| 023  | P3.1 | notification_export_jobs 表 + 5 个 widget + 2 权限码 |
| 024  | P3.2 | notification_schedules 表 + 2 类型 + 模板            |
| 025  | P3.3 | channel_config.priority + users.lang 字段            |
| 026  | P3.4 | SMS 腾讯云默认配置                                   |

---

## 二、Phase 1：主链路打通

> **详细文档**：[2026-05-16-notification-phase-1-00-overview.md](./2026-05-16-notification-phase-1-00-overview.md)
> **子任务文件**：p1-01 ～ p1-12（共 12 个子文件，22 个 Task）

### 2.1 P1 范围

**✅ 做**：

- DB 迁移 018（11 表 + 21 类型 + 14 权限码 + 角色绑定）
- BullMQ 队列骨架 + egg-socket.io 配置 + JWT 鉴权中间件
- `notification.send` / `sendDirect` / `sendByAudience`（受众支持 all/static）
- InAppAdapter（写库 + Socket emit）；EmailAdapter / SmsAdapter 占位（仅打日志）
- admin API：类型 CRUD + 模板 CRUD + 任务创建（仅立即发送）+ 消息查询
- C 端 API：消息列表/未读数/标记已读/归档/偏好读写
- Shared SDK：REST API + Socket Client + 4 个 React Hooks
- Admin UI：类型/模板/任务/消息/顶部铃铛
- H5 UI：AppHeader 加消息入口 + 通知列表 + 详情 + 偏好设置
- PC UI：Header 铃铛 + Dropdown 面板 + 通知列表 + 偏好设置
- 触发点：`feedback.reply` / `auth.unusualLogin` / `verify-code.send`

**❌ 不做（留 P2/P3）**：邮件/短信真实发送、频控、静默时段、动态受众编辑器、任务定时/Cron、数据统计看板、模板版本回滚 UI

### 2.2 P1 任务列表（22 个 Task）

| #   | 任务                                                       | 子文件                                     | 工程量 | 依赖            |
| --- | ---------------------------------------------------------- | ------------------------------------------ | ------ | --------------- |
| T1  | 后端：新增依赖 + 配置 + plugin 启用                        | `p1-01-deps-config.md`                     | S      | -               |
| T2  | 后端：错误码扩展（108xxx 段）                              | `p1-02-errcodes.md`                        | S      | T1              |
| T3  | 后端：模板渲染纯函数 + 单元测试                            | `p1-03-renderer.md`                        | S      | T1              |
| T4  | 后端：DB 迁移 018（11 表 + 预置 + 权限）                   | `p1-04-migration.md`                       | M      | T1              |
| T5  | 后端：11 个 Sequelize Model                                | `p1-05-models.md`                          | M      | T4              |
| T6  | 后端：notification-template service + 测试                 | `p1-06-services-template-pref-audience.md` | M      | T5, T3          |
| T7  | 后端：notification-preference service + 测试               | `p1-06-services-template-pref-audience.md` | S      | T5              |
| T8  | 后端：notification-audience service（仅 all/static）+ 测试 | `p1-06-services-template-pref-audience.md` | S      | T5              |
| T9  | 后端：BullMQ 队列骨架 + send worker                        | `p1-07-queue-channel.md`                   | M      | T1, T5          |
| T10 | 后端：渠道适配器（InApp 完整 + Email/Sms stub）            | `p1-07-queue-channel.md`                   | M      | T5, T9          |
| T11 | 后端：notification.send 主入口 + 测试                      | `p1-08-send-main.md`                       | M      | T6, T7, T8, T10 |
| T12 | 后端：Socket.IO 配置 + 鉴权中间件 + io controller          | `p1-09-socket-admin-api-1.md`              | M      | T1              |
| T13 | 后端：admin API（类型 + 模板 CRUD）                        | `p1-09-socket-admin-api-1.md`              | M      | T5, T6          |
| T14 | 后端：admin API（任务创建立即发送 + 消息查询）             | `p1-10-admin-cend-trigger.md`              | M      | T11, T13        |
| T15 | 后端：C 端 API（消息列表/未读数/已读/偏好）                | `p1-10-admin-cend-trigger.md`              | M      | T5, T7          |
| T16 | 后端：触发点改造（feedback / auth / verify-code）          | `p1-10-admin-cend-trigger.md`              | M      | T11             |
| T17 | Shared SDK：types + api + socket + hooks + 测试            | `p1-11-sdk.md`                             | L      | T12, T15        |
| T18 | Admin：路由 + permCodes + Notification 模块页面            | `p1-12-frontend-acceptance.md`             | L      | T13, T14        |
| T19 | Admin：顶部铃铛 + 我的通知页面 + 多端登录验证              | `p1-12-frontend-acceptance.md`             | M      | T17, T18        |
| T20 | H5：AppHeader 改造 + 消息中心页 + 偏好页 + SDK 接入        | `p1-12-frontend-acceptance.md`             | L      | T17             |
| T21 | PC：Header 改造 + 铃铛面板 + 消息中心 + SDK 接入           | `p1-12-frontend-acceptance.md`             | L      | T17             |
| T22 | 端到端联调 + P1 验收门禁清单逐项验证                       | `p1-12-frontend-acceptance.md`             | M      | T16-T21         |

### 2.3 P1 验收门禁

- [ ] 反馈回复 → 用户在 H5/PC 看到站内信 + Toast，3 秒内
- [ ] 异常登录 → 用户三端同步收到（email/sms 仅日志）
- [ ] admin 创建任务 → 100 用户立即发送 → 全部 success
- [ ] 多端登录：A 端读 → B 端列表自动变灰
- [ ] socket 断线 → 60 秒内自动重连
- [ ] 单元测试覆盖率 ≥ 70%（service 层）

---

## 三、Phase 2：多渠道 + 防骚扰

> **总览文档**：[2026-05-23-notification-phase-2-00-overview.md](./2026-05-23-notification-phase-2-00-overview.md)
> **前置条件**：P1 验收清单（22 项）全部通过 → tag `p1-notification-done`

### 3.1 P2.1：频控 + 静默时段 + 邮件真实发送

> **详细文档**：[2026-05-23-notification-p2-1-rate-quiet-mail.md](./2026-05-23-notification-p2-1-rate-quiet-mail.md)

**核心架构**：

- send 主入口插入"静默 → 频控"两层短路检查（命中后短路返回 108502/108503）
- 频控：Redis Lua 三层（user/type/global/channel）原子计数器，TTL 自动过期
- 静默：user_quiet_hours 表 + 类型级 `quietHourPolicy` 字段（respect/bypass/relax）
- EmailAdapter：nodemailer SMTP pool + HTML 包装 + 失败重试 3 次

| #   | Task                                           | 子文件                        | 工程量 |
| --- | ---------------------------------------------- | ----------------------------- | ------ |
| 1   | 依赖 + config + 错误码（108502/108503/108602） | `p2-1-01-deps-config.md`      | S      |
| 2   | DB 迁移 019 + Model                            | `p2-1-02-migration.md`        | M      |
| 3   | quiet-hours service + 8 单测                   | `p2-1-03-quiet-hours.md`      | M      |
| 4   | rate-limit service + Lua + 12 单测             | `p2-1-04-rate-limit.md`       | L      |
| 5   | mail.ts（nodemailer 封装）+ 6 单测             | `p2-1-05-mail-service.md`     | M      |
| 6   | EmailAdapter 真实化 + html renderer            | `p2-1-06-email-adapter.md`    | M      |
| 7   | send 主链路插入 quiet→rate 集成 + 3 集成测试   | `p2-1-07-send-integration.md` | M      |
| 8   | admin API（rate-limit / channel 配置）         | `p2-1-08-admin-api.md`        | M      |
| 9   | Admin UI（RateLimit / Channels 配置页）        | `p2-1-09-admin-ui.md`         | M      |
| 10  | 端到端联调 + P2.1 验收                         | `p2-1-10-acceptance.md`       | M      |

**P2.1 验收门禁**：

- [ ] 给真实邮箱发送邮件 → 收到 + send_log 记录正确 provider 和 cost_ms
- [ ] 22:30 触发 P3 营销 → skipped (quiet_hour)
- [ ] 同用户 1 小时内触发 21 次 → 第 21 次 skipped (rate_limited)
- [ ] 频控配置在 admin 端修改 → 5 分钟内生效

---

### 3.2 P2.2：任务定时与 Cron 调度

> **详细文档**：[2026-05-30-notification-p2-2-task-schedule.md](./2026-05-30-notification-p2-2-task-schedule.md)

**核心架构**：

- 一次性定时：BullMQ delayed job
- Cron 周期：BullMQ repeatable job，重启后由 startup 扫描恢复
- RRULE：服务端按 rrule.js 计算"下次触发时间"，转换为 BullMQ delayed job 链
- 30 秒撤销：immediate 任务挂 `scheduledAt = now + 30s` delayed job
- Stuck 恢复：启动时扫描 `status=running` 且 `started_at < now - 30min` 的任务

**新增依赖**：`rrule@^2.7` + `cron-parser@^4.x`

| #   | Task                                                   | 子文件                         | 工程量 |
| --- | ------------------------------------------------------ | ------------------------------ | ------ |
| 1   | 依赖 + config + 错误码（108303-108315）                | `p2-2-01-deps-config.md`       | S      |
| 2   | DB 迁移 020（task 表 +8 字段）+ Model                  | `p2-2-02-migration.md`         | M      |
| 3   | rruleHelper + cronHelper + 测试                        | `p2-2-03-helpers.md`           | M      |
| 4   | task 队列 + worker                                     | `p2-2-04-queue-worker.md`      | M      |
| 5   | scheduler service（4 sendType + 4 生命周期 + 18 单测） | `p2-2-05-scheduler-service.md` | L      |
| 6   | 启动 boot：恢复 cron/rrule + stuck 扫描                | `p2-2-06-boot.md`              | M      |
| 7   | admin API（扩展 task 创建 + pause/resume/cancel/undo） | `p2-2-07-admin-api.md`         | M      |
| 8   | Admin UI（Wizard 改造 + 详情操作按钮）                 | `p2-2-08-admin-ui.md`          | L      |
| 9   | 端到端联调 + P2.2 验收                                 | `p2-2-09-acceptance.md`        | M      |

**P2.2 验收门禁**：

- [ ] 4 种 sendType（immediate/scheduled/cron/rrule）全部可创建并触发
- [ ] 30 秒撤销窗口内点撤销 → BullMQ job 被移除
- [ ] 重启后 cron/rrule 任务自动恢复
- [ ] stuck 任务（>30min running）自动标 failed

---

### 3.3 P2.3：动态受众规则引擎

> **详细文档**：[2026-06-06-notification-p2-3-dynamic-audience.md](./2026-06-06-notification-p2-3-dynamic-audience.md)

**核心架构**：

- 规则模型：`{ operator: 'and'|'or', conditions: [Cond | Group] }`，最大嵌套 3 层
- 字段白名单：5 张表 9 字段（user/member/role/device/favorite）
- 操作符 9 种：`eq/ne/gt/gte/lt/lte/in/nin/between`
- 相对时间：`P{N}D` 转换为 `now() - INTERVAL N DAY`
- 编译器：`audienceRuleCompiler`：JSON → 安全的 SQL 片段（字段白名单 + 参数化值）

| #   | Task                                                              | 子文件                          | 工程量 |
| --- | ----------------------------------------------------------------- | ------------------------------- | ------ |
| 1   | DB 迁移 021 + 错误码（108201/108211/108212/108220-108222）+ Model | `p2-3-01-migration-errcodes.md` | M      |
| 2   | relativeTimeParser + 6 单测                                       | `p2-3-02-relative-time.md`      | S      |
| 3   | audienceFieldWhitelist 元数据表                                   | `p2-3-03-whitelist.md`          | S      |
| 4   | audienceRuleCompiler + 18 单测                                    | `p2-3-04-compiler.md`           | L      |
| 5   | notification-audience service 改造 + 8 单测                       | `p2-3-05-audience-service.md`   | M      |
| 6   | admin API（audiences CRUD + /preview）+ 6 e2e                     | `p2-3-06-admin-api.md`          | M      |
| 7   | Admin UI - RuleBuilder 组件套件（6 子组件）                       | `p2-3-07-admin-rule-builder.md` | L      |
| 8   | Admin UI - Audiences 页面 + AudiencePreview + Tasks Wizard 接入   | `p2-3-08-admin-pages.md`        | M      |
| 9   | 端到端联调 + P2.3 验收                                            | `p2-3-09-acceptance.md`         | M      |

**字段白名单**：

| field 路径           | DB 表                              | 类型     | 允许操作符    |
| -------------------- | ---------------------------------- | -------- | ------------- |
| `user.id`            | `users`                            | int      | eq/ne/in/nin  |
| `user.status`        | `users`                            | int      | eq/ne         |
| `user.created_at`    | `users`                            | datetime | gte/lte/gt/lt |
| `user.last_login_at` | `users`                            | datetime | gte/lte/gt/lt |
| `member.level_id`    | `member_subscriptions`             | int      | eq/ne/in/nin  |
| `member.expire_at`   | `member_subscriptions`             | datetime | gte/lte/gt/lt |
| `role.code`          | `admin_user_roles` + `admin_roles` | string   | in/nin        |
| `device.platform`    | `user_devices`                     | string   | in/nin        |
| `favorite.tool_id`   | `user_tool_favorites`              | int      | eq/in         |

**P2.3 验收门禁**：

- [ ] 创建动态分组规则 "VIP + 30天活跃" → 预览人数误差 < 5%
- [ ] 嵌套 3 层 AND/OR 规则正确编译为 SQL
- [ ] 字段不在白名单 → 抛 108211
- [ ] 嵌套 > 3 层 → 抛 108220

---

### 3.4 P2.4：新触发点 + 模板版本回滚 UI

> **详细文档**：[2026-06-13-notification-p2-4-triggers-rollback.md](./2026-06-13-notification-p2-4-triggers-rollback.md)

**核心内容**：

- 5 个业务触发点接入 `notification.send` 主链路
- 模板版本回滚 UI（DB 已就绪，补齐前端）

**5 个业务类型**：

| typeKey            | 名称         | 优先级 | 默认渠道      | 触发文件                |
| ------------------ | ------------ | ------ | ------------- | ----------------------- |
| `member_upgrade`   | 会员升级成功 | high   | inApp + email | `app/service/member.ts` |
| `points_change`    | 积分变动     | normal | inApp         | `app/service/member.ts` |
| `invite_success`   | 邀请好友成功 | normal | inApp         | `app/service/invite.ts` |
| `tool_published`   | 工具上线     | normal | inApp         | `app/service/tool.ts`   |
| `tool_unpublished` | 工具下架     | normal | inApp         | `app/service/tool.ts`   |

| #   | Task                                                       | 子文件                                 | 工程量 |
| --- | ---------------------------------------------------------- | -------------------------------------- | ------ |
| 1   | DB 迁移 022（5 type + 模板 seed）+ 错误码（108120/108121） | `p2-4-01-migration-types-templates.md` | M      |
| 2   | 模板回滚 service + 4 单测                                  | `p2-4-02-template-rollback.md`         | M      |
| 3   | 触发点：member.upgrade + member.pointsChange + 测试        | `p2-4-03-trigger-member.md`            | M      |
| 4   | 触发点：invite.success + 测试                              | `p2-4-04-trigger-invite.md`            | S      |
| 5   | 触发点：tool.published + tool.unpublished + 测试           | `p2-4-05-trigger-tool.md`              | M      |
| 6   | Admin UI - TemplateVersionDrawer + VersionDiffView         | `p2-4-06-admin-version-ui.md`          | M      |
| 7   | 端到端联调 + P2.4 验收 + P2 完结 tag                       | `p2-4-07-acceptance.md`                | M      |

**P2.4 验收门禁**：

- [ ] 5 个触发点全部接入，失败不影响业务事务
- [ ] 工具上架后 → 收藏者全部收到通知（动态受众 P2.3）
- [ ] 模板版本回滚 UI 可用，回滚后新通知使用回滚版本
- [ ] 用户关闭某类型订阅 → 后续该类型通知 in_app 也不再产生

---

## 四、Phase 3：高级运营

> **总览文档**：[2026-06-20-notification-phase-3-00-overview.md](./2026-06-20-notification-phase-3-00-overview.md)
> **前置条件**：P1 + P2.1 + P2.2 + P2.3 + P2.4 全部已合入 master，tag `p2-done`

### 4.1 P3.1：Stats 数据看板 + Dashboard widget + 异步导出

> **详细文档**：[2026-06-20-notification-p3-1-stats-dashboard.md](./2026-06-20-notification-p3-1-stats-dashboard.md)

**核心架构**：

- stats service：5 类聚合查询（overview/trend/byChannel/byType/funnel）+ 5 分钟内存缓存
- Stats 大模块：admin 4 Tab（Overview/Trend/Distribution/Funnel）
- Dashboard widget：5 种 widget 注册到现有 `dashboard_widget` registry
- 异步导出：admin 提交筛选 → `notif.export` 队列 → worker 写 xlsx → 邮件附件发给操作者

**新增依赖**：`xlsx@^0.18.5`

| #   | Task                                                       | 依赖   |
| --- | ---------------------------------------------------------- | ------ |
| 1   | 依赖（xlsx）+ config + 错误码（108700-108705）             | -      |
| 2   | DB 迁移 023（export_jobs 表 + 5 widget + 2 权限码）+ Model | T1     |
| 3   | notification-stats service（5 类查询 + 缓存）+ 6 单测      | T2     |
| 4   | xlsxBuilder lib + 4 单测                                   | T1     |
| 5   | notif.export 队列 + worker + service + 5 单测              | T4     |
| 6   | admin API（stats 5 + export 3）+ 4 e2e                     | T3, T5 |
| 7   | Admin UI - Stats 大模块（4 Tab + ExportModal）             | T6     |
| 8   | Admin UI - 5 Dashboard widget                              | T6     |
| 9   | 端到端联调 + 验收 + tag p3-1-done                          | T1-T8  |

**5 个 Dashboard widget**：

| widget code              | 名称            | 数据源                         |
| ------------------------ | --------------- | ------------------------------ |
| `notif_unread_count`     | 我的未读通知    | `notification:unread`          |
| `notif_send_trend_7d`    | 近 7 天发送趋势 | `notification:stats:trend7d`   |
| `notif_channel_dist_pie` | 渠道分布        | `notification:stats:byChannel` |
| `notif_top_types`        | Top 通知类型    | `notification:stats:byType`    |
| `notif_queue_depth`      | 队列深度        | `notification:queue:depth`     |

**P3.1 验收门禁**：

- [ ] Stats 5 类查询单次 ≤ 2s（90 天范围）
- [ ] 第二次相同查询走缓存 ≤ 50ms
- [ ] 10 万行导出 ≤ 60s
- [ ] 数据导出完成后邮件附件可下载

---

### 4.2 P3.2：Member 到期 schedule + 数据清理 + alert 对接

> **详细文档**：[2026-06-27-notification-p3-2-member-schedule-alert.md](./2026-06-27-notification-p3-2-member-schedule-alert.md)

**核心内容**：

- 4 个定时 schedule（会员到期 7/3/1 天 / 消息清理 / 日志清理 / 导出文件清理）
- alert 系统对接（系统告警转 inApp 通知给超管）
- Stuck 增强：扫描覆盖 `notification_export_jobs`

**4 个内置 schedule**：

| code                 | 名称         | cron         | 处理器                         |
| -------------------- | ------------ | ------------ | ------------------------------ |
| `member_expire_soon` | 会员到期提醒 | `0 9 * * *`  | memberExpireSoon（7/3/1 天）   |
| `cleanup_messages`   | 消息表清理   | `0 3 * * *`  | cleanupMessages（保留 90 天）  |
| `cleanup_send_logs`  | 发送日志清理 | `30 3 * * *` | cleanupSendLogs（保留 30 天）  |
| `cleanup_exports`    | 导出文件清理 | `15 * * * *` | cleanupExports（清理过期文件） |

| #   | Task                                                    | 依赖  |
| --- | ------------------------------------------------------- | ----- |
| 1   | 依赖 + config + 错误码（108710-108715）                 | -     |
| 2   | DB 迁移 024（schedules 表 + 2 type seed + 模板）        | T1    |
| 3   | notification-schedule service（注册/卸载/列表）+ 6 单测 | T2    |
| 4   | 4 个 schedule 处理器 + 测试                             | T3    |
| 5   | boot 集成：注册 4 schedule + Stuck 扫描扩展到 export    | T4    |
| 6   | alert 对接 + admin API（schedules 列表/暂停/恢复）+ UI  | T5    |
| 7   | 端到端联调 + 验收 + tag p3-2-done                       | T1-T6 |

**P3.2 验收门禁**：

- [ ] 会员 7 天后到期 → 09:00 自动收到通知；幂等键防重复
- [ ] cleanup_messages 删除 90+ 天数据，保留 ≤ 90 天的不动
- [ ] alert 触发 → 所有超管收到通知
- [ ] 重启后 schedule 自动注册

---

### 4.3 P3.3：多 SMTP 自动切换 + 模板 i18n

> **详细文档**：[2026-07-04-notification-p3-3-multi-smtp-i18n.md](./2026-07-04-notification-p3-3-multi-smtp-i18n.md)

**核心架构**：

- 多 SMTP：从 `notification_channel_config` 加载多条 enabled 配置，按 `priority` 排序，主 SMTP 失败自动切换到备；定时健康检查每 5 分钟更新 `last_health_at/ok`
- i18n：按用户 `users.lang` 字段选模板（找不到回退 zh-CN）；支持 zh-CN / en-US

| #   | Task                                                                  | 依赖  |
| --- | --------------------------------------------------------------------- | ----- |
| 1   | DB 迁移 025（channel.priority + users.lang）+ 错误码（108720-108723） | -     |
| 2   | mail.ts 多 SMTP 改造（transport pool + 故障转移）+ 5 单测             | T1    |
| 3   | 健康检查 schedule（每 5 分钟）+ 2 单测                                | T2    |
| 4   | template 渲染按 lang 选择 + fallback zh-CN + 5 单测                   | T1    |
| 5   | C 端 API：用户语言偏好（PUT /api/users/me/lang）+ 2 单测              | T1    |
| 6   | admin Templates UI 增加 lang 过滤 + 复制到其他语言按钮                | T4    |
| 7   | 端到端联调 + 验收 + tag p3-3-done                                     | T1-T6 |

**P3.3 验收门禁**：

- [ ] 主 SMTP 故意配错密码 → 自动 fallback 到备；用户收到邮件
- [ ] 全部 SMTP 失败 → 抛 108720；BullMQ 重试
- [ ] user.lang=en-US 触发通知（仅有 zh-CN 模板）→ fallback zh-CN，不抛错
- [ ] admin 复制 zh-CN 到 en-US 后再触发 → 用户收到英文版本

---

### 4.4 P3.4：短信真实接入 + 大任务进度推送 + 队列监控

> **详细文档**：[2026-07-11-notification-p3-4-sms-real-progress.md](./2026-07-11-notification-p3-4-sms-real-progress.md)

**核心架构**：

- 短信：复用项目 `app/service/sms.ts` 已有的腾讯云 SMS 调用；SmsAdapter 改为调 sms.send；保留 fallbackToLog 开关
- 进度：`sendByAudience` 处理 ≥1000 用户时通过 socket emit `task:progress` 给 admin room（每 100 条一次）
- 队列监控：直接调 BullMQ `Queue.getJobCounts()` 返回 active/waiting/delayed/failed/completed

| #   | Task                                                           | 依赖  |
| --- | -------------------------------------------------------------- | ----- |
| 1   | 依赖 / config / 错误码（108730-108735）                        | -     |
| 2   | DB 迁移 026（SMS 腾讯云默认配置）+ Model                       | T1    |
| 3   | SmsAdapter 真实化（调 sms.send）+ 4 单测                       | T2    |
| 4   | sendByAudience 进度推送（≥1000 分批）+ 4 单测                  | T3    |
| 5   | 队列监控 service + admin API（4 队列深度）+ 3 单测             | T4    |
| 6   | admin UI - QueueDepthWidget 真实化 + /notification/queues 页面 | T5    |
| 7   | 端到端联调 + 验收 + tag p3-4-done + tag p3-done                | T1-T6 |

**P3.4 验收门禁**：

- [ ] 短信渠道发送 verify-code → 用户实际收到短信，send_log 含 providerResp.tencent
- [ ] 1500 用户 sendByAudience → admin dashboard 收到 15 次 progress + 1 次 completed
- [ ] <1000 用户不推送进度
- [ ] 队列监控页 4 队列实时刷新（5 秒一次）
- [ ] 失败重试按钮 → 失败 job 进入 waiting；attemptsMade 加 1

---

## 五、全局约定

### 5.1 错误码段位

| 段位          | 阶段    | 用途                               |
| ------------- | ------- | ---------------------------------- |
| 108100-108199 | P1      | 通知类型/模板/消息基础错误         |
| 108200-108299 | P1/P2.3 | 受众相关错误                       |
| 108300-108399 | P1/P2.2 | 任务/调度相关错误                  |
| 108400-108499 | P1      | 偏好/配置相关错误                  |
| 108500-108599 | P1/P2.1 | 发送流程错误（频控/静默/渠道）     |
| 108600-108699 | P2.1    | 邮件发送错误                       |
| 108700-108705 | P3.1    | 统计/导出错误                      |
| 108710-108715 | P3.2    | schedule 错误                      |
| 108720-108725 | P3.3    | 多 SMTP / i18n 错误                |
| 108730-108735 | P3.4    | 短信真实 / 进度推送 / 队列监控错误 |

### 5.2 Commit 规范

```
feat(notification): <task summary in english>

<optional body explaining what / why>

Refs: docs/analysis/通知推送系统模块设计需求文档.md (V2 §X.Y)
Plan: docs/superpowers/plans/<sub-plan-file>.md (Task N)
```

### 5.3 测试策略

| 层                | 工具                     | 覆盖率目标                   |
| ----------------- | ------------------------ | ---------------------------- |
| 后端 service 单测 | `egg-mock` + `jest`      | P1 ≥ 70%；P2 ≥ 75%；P3 ≥ 80% |
| 后端 e2e          | `egg-mock` + `supertest` | 触发点 100%                  |
| SDK 单测          | `jest` + `msw`           | 核心 hooks 覆盖              |
| 前端 UI           | 端到端联调清单验证       | -                            |

### 5.4 回滚策略

- 每个 DB 迁移都有对应的 `xxx_rollback.sql`，可独立回滚
- BullMQ / socket.io 配置可独立关闭
- `config.notification.enabled` kill switch：紧急时关闭让所有 send 直接 return，业务不受影响

---

## 六、子文件索引

### Phase 1 子文件（12 个）

| 文件                                                                                     | Task    | 主要交付物                                |
| ---------------------------------------------------------------------------------------- | ------- | ----------------------------------------- |
| [`p1-01-deps-config.md`](./p1-01-deps-config.md)                                         | T1      | 依赖 + plugin 启用 + config 配置          |
| [`p1-02-errcodes.md`](./p1-02-errcodes.md)                                               | T2      | 108xxx 错误码                             |
| [`p1-03-renderer.md`](./p1-03-renderer.md)                                               | T3      | 模板渲染纯函数 + 单元测试                 |
| [`p1-04-migration.md`](./p1-04-migration.md)                                             | T4      | DB 迁移 018（11 表 + 21 类型 + 14 权限）  |
| [`p1-05-models.md`](./p1-05-models.md)                                                   | T5      | 11 个 Sequelize Model                     |
| [`p1-06-services-template-pref-audience.md`](./p1-06-services-template-pref-audience.md) | T6-T8   | template / preference / audience service  |
| [`p1-07-queue-channel.md`](./p1-07-queue-channel.md)                                     | T9-T10  | BullMQ 队列骨架 + 渠道适配器              |
| [`p1-08-send-main.md`](./p1-08-send-main.md)                                             | T11     | `notification.send` 主入口 + 完整测试     |
| [`p1-09-socket-admin-api-1.md`](./p1-09-socket-admin-api-1.md)                           | T12-T13 | Socket.IO 鉴权 + admin 类型/模板 API      |
| [`p1-10-admin-cend-trigger.md`](./p1-10-admin-cend-trigger.md)                           | T14-T16 | admin 任务+消息 / C 端 API / 三触发点改造 |
| [`p1-11-sdk.md`](./p1-11-sdk.md)                                                         | T17     | shared/notification-sdk 全套              |
| [`p1-12-frontend-acceptance.md`](./p1-12-frontend-acceptance.md)                         | T18-T22 | admin 页面 / H5 / PC / 联调验收           |

### Phase 2 子文件（18 个）

| 文件                                                                             | 阶段     | 主要交付物               |
| -------------------------------------------------------------------------------- | -------- | ------------------------ |
| [`p2-1-01-deps-config.md`](./p2-1-01-deps-config.md)                             | P2.1 T1  | nodemailer 依赖 + 错误码 |
| [`p2-1-02-migration.md`](./p2-1-02-migration.md)                                 | P2.1 T2  | DB 迁移 019              |
| [`p2-1-03-quiet-hours.md`](./p2-1-03-quiet-hours.md)                             | P2.1 T3  | quiet-hours service      |
| [`p2-1-04-rate-limit.md`](./p2-1-04-rate-limit.md)                               | P2.1 T4  | rate-limit service + Lua |
| [`p2-1-05-mail-service.md`](./p2-1-05-mail-service.md)                           | P2.1 T5  | mail.ts                  |
| [`p2-1-06-email-adapter.md`](./p2-1-06-email-adapter.md)                         | P2.1 T6  | EmailAdapter 真实化      |
| [`p2-1-07-send-integration.md`](./p2-1-07-send-integration.md)                   | P2.1 T7  | send 主链路集成          |
| [`p2-1-08-admin-api.md`](./p2-1-08-admin-api.md)                                 | P2.1 T8  | admin 频控/渠道 API      |
| [`p2-1-09-admin-ui.md`](./p2-1-09-admin-ui.md)                                   | P2.1 T9  | Admin UI 配置页          |
| [`p2-1-10-acceptance.md`](./p2-1-10-acceptance.md)                               | P2.1 T10 | P2.1 验收                |
| [`p2-2-01-deps-config.md`](./p2-2-01-deps-config.md)                             | P2.2 T1  | rrule/cron-parser 依赖   |
| [`p2-2-02-migration.md`](./p2-2-02-migration.md)                                 | P2.2 T2  | DB 迁移 020              |
| [`p2-2-03-helpers.md`](./p2-2-03-helpers.md)                                     | P2.2 T3  | rruleHelper + cronHelper |
| [`p2-2-04-queue-worker.md`](./p2-2-04-queue-worker.md)                           | P2.2 T4  | task 队列 + worker       |
| [`p2-2-05-scheduler-service.md`](./p2-2-05-scheduler-service.md)                 | P2.2 T5  | scheduler service        |
| [`p2-2-06-boot.md`](./p2-2-06-boot.md)                                           | P2.2 T6  | 启动 boot                |
| [`p2-2-07-admin-api.md`](./p2-2-07-admin-api.md)                                 | P2.2 T7  | admin 任务调度 API       |
| [`p2-2-08-admin-ui.md`](./p2-2-08-admin-ui.md)                                   | P2.2 T8  | Admin UI Wizard 改造     |
| [`p2-2-09-acceptance.md`](./p2-2-09-acceptance.md)                               | P2.2 T9  | P2.2 验收                |
| [`p2-3-01-migration-errcodes.md`](./p2-3-01-migration-errcodes.md)               | P2.3 T1  | DB 迁移 021 + 错误码     |
| [`p2-3-02-relative-time.md`](./p2-3-02-relative-time.md)                         | P2.3 T2  | relativeTimeParser       |
| [`p2-3-03-whitelist.md`](./p2-3-03-whitelist.md)                                 | P2.3 T3  | 字段白名单元数据         |
| [`p2-3-04-compiler.md`](./p2-3-04-compiler.md)                                   | P2.3 T4  | audienceRuleCompiler     |
| [`p2-3-05-audience-service.md`](./p2-3-05-audience-service.md)                   | P2.3 T5  | audience service 改造    |
| [`p2-3-06-admin-api.md`](./p2-3-06-admin-api.md)                                 | P2.3 T6  | admin 受众 API           |
| [`p2-3-07-admin-rule-builder.md`](./p2-3-07-admin-rule-builder.md)               | P2.3 T7  | RuleBuilder 组件         |
| [`p2-3-08-admin-pages.md`](./p2-3-08-admin-pages.md)                             | P2.3 T8  | Audiences 页面           |
| [`p2-3-09-acceptance.md`](./p2-3-09-acceptance.md)                               | P2.3 T9  | P2.3 验收                |
| [`p2-4-01-migration-types-templates.md`](./p2-4-01-migration-types-templates.md) | P2.4 T1  | DB 迁移 022              |
| [`p2-4-02-template-rollback.md`](./p2-4-02-template-rollback.md)                 | P2.4 T2  | 模板回滚 service         |
| [`p2-4-03-trigger-member.md`](./p2-4-03-trigger-member.md)                       | P2.4 T3  | 会员触发点               |
| [`p2-4-04-trigger-invite.md`](./p2-4-04-trigger-invite.md)                       | P2.4 T4  | 邀请触发点               |
| [`p2-4-05-trigger-tool.md`](./p2-4-05-trigger-tool.md)                           | P2.4 T5  | 工具触发点               |
| [`p2-4-06-admin-version-ui.md`](./p2-4-06-admin-version-ui.md)                   | P2.4 T6  | 版本回滚 UI              |
| [`p2-4-07-acceptance.md`](./p2-4-07-acceptance.md)                               | P2.4 T7  | P2.4 验收 + P2 完结      |

### Phase 3 子文件（4 个主文件）

| 文件                                                                                                               | 阶段 | 主要交付物                                |
| ------------------------------------------------------------------------------------------------------------------ | ---- | ----------------------------------------- |
| [`2026-06-20-notification-p3-1-stats-dashboard.md`](./2026-06-20-notification-p3-1-stats-dashboard.md)             | P3.1 | Stats 看板 + widget + 导出（9 Tasks）     |
| [`2026-06-27-notification-p3-2-member-schedule-alert.md`](./2026-06-27-notification-p3-2-member-schedule-alert.md) | P3.2 | Schedule + alert（7 Tasks）               |
| [`2026-07-04-notification-p3-3-multi-smtp-i18n.md`](./2026-07-04-notification-p3-3-multi-smtp-i18n.md)             | P3.3 | 多 SMTP + i18n（7 Tasks）                 |
| [`2026-07-11-notification-p3-4-sms-real-progress.md`](./2026-07-11-notification-p3-4-sms-real-progress.md)         | P3.4 | SMS 真实 + 进度推送 + 队列监控（7 Tasks） |

---

## 七、整体验收门禁

### 7.1 功能验收（P0 必须通过）

- [ ] 三种发送方式：立即 / 定时（精确到分钟）/ Cron
- [ ] 三种渠道：站内信 + 邮件 + 短信全链路通畅
- [ ] 14 类业务模板覆盖全部触发点
- [ ] 用户偏好实时生效，强制类型不可关闭
- [ ] 频控、静默、优先级矩阵按需求文档 §7.4 表格执行
- [ ] socket 多端同步：列表/未读数/已读状态
- [ ] 模板版本历史 + 一键回滚
- [ ] 受众动态规则 + 预览人数 + 抽样
- [ ] 任务暂停/取消/重试失败 + 30 秒撤销
- [ ] 数据看板 + 异步导出 + 邮件接收

### 7.2 功能验收（P1 应通过）

- [ ] Dashboard widget 5 种
- [ ] 渠道熔断与降级（多 SMTP 自动切换）
- [ ] 队列健康度监控页
- [ ] 浏览器原生 Web Notifications（PC）

### 7.3 性能验收

| 指标                    | 目标                                      |
| ----------------------- | ----------------------------------------- |
| P0 端到端延迟           | < 3 秒（业务调用 → 用户收到 socket 推送） |
| API P99 响应时间        | < 300ms                                   |
| 批量发送吞吐            | ≥ 1000 条/秒（in_app）                    |
| 100 万用户大任务        | < 30 分钟                                 |
| Socket 连接建立         | < 1 秒                                    |
| Stats 查询（90 天范围） | < 2s；缓存命中 < 50ms                     |

### 7.4 可靠性验收

- [ ] 入队后投递成功率 ≥ 99.5%（含重试）
- [ ] 系统可用性 99.5%
- [ ] 故障恢复 < 60 秒（Redis 重启后 stuck 任务恢复）
- [ ] 幂等性：同 idempotentKey 24h 内不重复发送

### 7.5 安全验收

- [ ] 接口鉴权 + 14 个权限码矩阵生效
- [ ] 数据脱敏（手机号/邮箱）
- [ ] 敏感字段 AES 加密（channel_configs.config）
- [ ] XSS 防护 + 模板注入防护
- [ ] 全部变更写 audit_logs

### 7.6 质量验收

- [ ] 后端 service 层单测覆盖率 ≥ 80%
- [ ] 触发点 e2e 测试覆盖率 100%（14 个触发点全覆盖）
- [ ] socket 端到端测试（连接/推送/断线/重连/降级）
- [ ] 前端关键流程 e2e（消息中心/偏好/Toast）

---

## 附录：全阶段 Tag 清单

| Tag                    | 含义                              |
| ---------------------- | --------------------------------- |
| `p1-notification-done` | P1 主链路打通完成                 |
| `p2-1-done`            | P2.1 频控/静默/邮件完成           |
| `p2-2-done`            | P2.2 任务调度完成                 |
| `p2-3-done`            | P2.3 动态受众完成                 |
| `p2-4-done`            | P2.4 触发点/回滚完成              |
| `p2-done`              | P2 全阶段完成                     |
| `p3-1-done`            | P3.1 Stats/导出完成               |
| `p3-2-done`            | P3.2 Schedule/alert 完成          |
| `p3-3-done`            | P3.3 多 SMTP/i18n 完成            |
| `p3-4-done`            | P3.4 SMS/进度/队列监控完成        |
| `p3-done`              | P3 全阶段完成（通知模块 V2 完结） |

---

_汇总文档生成时间：2026-05-20 | 基于需求文档 V2.0 | 覆盖 P1 + P2 + P3 全部计划_
