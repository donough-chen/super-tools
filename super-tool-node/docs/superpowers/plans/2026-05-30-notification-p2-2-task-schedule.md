# P2.2 实施计划：任务定时与 Cron 调度（总览）

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement each Task by sub-file.

**Goal:** 在 P1 通知任务"立即发送"基础上，扩展 4 类调度模式（一次性定时 / Cron 周期 / RRULE / 30 秒撤销）+ 任务生命周期完整管理（暂停/恢复/取消）+ Stuck 任务自动恢复，让运营具备真实生产环境的批量发送能力。

**Architecture:**
- 一次性定时：BullMQ delayed job（`delay: targetTs - now`）
- Cron 周期：BullMQ repeatable job（`repeat.cron`），重启后由 startup 扫描 task 表恢复
- RRULE：服务端按 rrule.js 计算"下次触发时间"，转换为 BullMQ delayed job 链（每次触发完算下一次）
- 30 秒撤销：immediate 任务在 `scheduledAt = now + 30s` 上挂 delayed job；用户在 30s 内点撤销 → BullMQ remove
- Stuck 恢复：app 启动时扫描 `status=running` 且 `started_at < now - 30min` 的任务标记为 `failed`，并 emit alarm

**Tech Stack:**
- 后端：Egg.js 3 + BullMQ delayed/repeat + rrule ^2.7（新依赖） + cron-parser ^4.x
- Admin：UmiJS 4 + AntD 5 扩展 CreateTaskWizard 增加 4 种 sendType + 任务详情新增暂停/取消/撤销操作

**Reference:** [通知推送系统模块设计需求文档（V2）](../../analysis/通知推送系统模块设计需求文档.md) §6.6

**前置条件**：
- P1 已合入 master，tag `p1-notification-done`
- P2.1 已合入，tag `p2-1-done`
- 阅读需求文档 §6.6（任务调度）、§14.2.2 P1 验收清单 #4-7

---

## 范围（明确做与不做）

### ✅ 做

| 模块 | 内容 |
|------|------|
| DB 迁移 020 | task 表新增 `scheduled_at / cron_expr / rrule / undo_window_sec / paused_at / canceled_at / next_fire_at / last_fire_at` 8 字段 |
| 后端 service | `notification-task-scheduler`：4 种 sendType 入口（immediate/scheduled/cron/rrule）+ 暂停/恢复/取消/撤销 + Stuck 扫描 |
| 后端 worker | 新增 `notif.task` 队列：处理"任务触发 → 调用 sendByAudience"；与 P1 `notif.send` 解耦 |
| 后端 admin API | task CRUD 扩展支持 4 sendType；新增 pause/resume/cancel/undo 4 端点；列表加 next_fire_at 列 |
| Admin UI | CreateTaskWizard Step 1 增加 sendType 选择；详情 Drawer 增加 4 个操作按钮；列表加倒计时显示 |
| 启动钩子 | `app.ts didReady`：扫描 cron/rrule 任务恢复 BullMQ repeat job；扫描 stuck 任务标 failed |
| 单测覆盖 | scheduler 18 用例（4 种 sendType + 4 种生命周期 + Stuck）+ rrule 计算 5 用例 + admin API 6 用例 |

### ❌ 不做（留 P2.3 / P2.4 / P3）

- 动态受众规则编辑器（P2.3）
- 任务进度推送（>1000 用户大批量进度条；P3）
- 任务执行日志详细统计（P3 看板）
- 优先级队列（P3 高优类型抢占）

---

## 文件结构总览

### 后端

```
super-tool-node/
├── package.json                                # 修改：+rrule@^2.7 +cron-parser@^4.x
├── config/config.default.ts                    # 修改：notification.task.* 配置块
├── database/
│   ├── 020_p2_task_schedule.sql                # 新建
│   └── 020_rollback.sql                        # 新建
├── app/
│   ├── constants/errorCodes.ts                 # 修改：实装 108303-108315
│   ├── service/
│   │   ├── notification-task-scheduler.ts      # 新建：调度核心
│   │   └── notification.ts                     # 修改：sendByAudience 内部允许 taskId 透传
│   ├── queue/
│   │   ├── queues.ts                           # 修改：+task 队列
│   │   └── workers/task.worker.ts              # 新建
│   ├── lib/
│   │   ├── rruleHelper.ts                      # 新建：next/preview
│   │   └── cronHelper.ts                       # 新建：parse/validate
│   ├── controller/admin/
│   │   └── notification-task.ts                # 修改：扩展 4 sendType + 4 操作端点
│   ├── boot/
│   │   └── taskScheduleBoot.ts                 # 新建：启动恢复 + stuck 扫描
│   ├── app.ts                                  # 修改：didReady 调 boot
│   └── router.ts                               # 修改：注册新路由
└── test/notification/
    ├── service/
    │   ├── notification-task-scheduler.test.ts # 18 用例
    │   └── lib-rrule-helper.test.ts            # 5 用例
    └── controller/admin/
        └── notification-task-schedule.test.ts  # 6 用例
```

### 管理端

```
super-tools-admin/
└── src/pages/Notification/Tasks/
    ├── CreateTaskWizard.tsx                    # 修改：Step1 增加 sendType 选择 + 各类参数
    ├── TaskDetailDrawer.tsx                    # 修改：增加 pause/resume/cancel/undo 操作
    └── components/
        ├── ScheduleTypeRadio.tsx               # 新建：4 种 sendType 选择
        ├── DateTimePicker.tsx                  # 新建：scheduledAt 选择（30s 起步）
        ├── CronEditor.tsx                      # 新建：cron 表达式 + 预览未来 5 次
        └── RRuleEditor.tsx                     # 新建：rrule 简化编辑器（FREQ + BYDAY + BYHOUR）
```

---

## 任务列表（10 Task，分 8 个子文件）

| # | Task | 子文件 | 工程量 | 依赖 |
|---|------|--------|-------|------|
| 1 | 依赖 + config + 错误码 | [`p2-2-01-deps-config.md`](./p2-2-01-deps-config.md) | S | - |
| 2 | DB 迁移 020 + Model 字段 | [`p2-2-02-migration.md`](./p2-2-02-migration.md) | M | 1 |
| 3 | rruleHelper + cronHelper + 测试 | [`p2-2-03-helpers.md`](./p2-2-03-helpers.md) | M | 1 |
| 4 | task 队列 + worker | [`p2-2-04-queue-worker.md`](./p2-2-04-queue-worker.md) | M | 2 |
| 5 | scheduler service（4 sendType + 4 生命周期 + 18 用例） | [`p2-2-05-scheduler-service.md`](./p2-2-05-scheduler-service.md) | L | 3, 4 |
| 6 | 启动 boot：恢复 cron/rrule + stuck 扫描 | [`p2-2-06-boot.md`](./p2-2-06-boot.md) | M | 5 |
| 7 | admin API（扩展 task 创建 + 4 操作端点） | [`p2-2-07-admin-api.md`](./p2-2-07-admin-api.md) | M | 5 |
| 8 | Admin UI（Wizard 改造 + 详情操作） | [`p2-2-08-admin-ui.md`](./p2-2-08-admin-ui.md) | L | 7 |
| 9 | 端到端联调 + P2.2 验收 + tag p2-2-done | [`p2-2-09-acceptance.md`](./p2-2-09-acceptance.md) | M | 1-8 |

> 共 9 子文件（少于 P2.1 的 10 个）；Task 4 队列与 Task 5 scheduler 拆分清晰，便于独立 commit。

### 子文件依赖关系

```
01-deps → 02-migration ─┬─► 03-helpers ─┐
                        │               ↓
                        └──► 04-queue ──► 05-scheduler ─┬─► 06-boot
                                                        ├─► 07-admin-api
                                                        │       │
                                                        │       ↓
                                                        └─► 08-admin-ui
                                                                │
                                                                ↓
                                                          09-acceptance
```

---

## P2.2 共享前提

### 错误码段位

P2.2 使用 `108303 ~ 108315` 段（在 P1 errorCodes 中已占位 `108303 SCHEDULE_TOO_SOON / 108304 CRON_INVALID`）。

新增以下错误码，需在 Task 1 内一并实装：

| 错误码 | 常量 | 含义 |
|--------|------|------|
| 108310 | NOTIFY_TASK_RRULE_INVALID | RRULE 格式非法 |
| 108311 | NOTIFY_TASK_CANNOT_PAUSE | 任务状态不允许暂停（仅 running/scheduled 可） |
| 108312 | NOTIFY_TASK_CANNOT_RESUME | 任务状态不允许恢复（仅 paused 可） |
| 108313 | NOTIFY_TASK_CANNOT_CANCEL | 任务状态不允许取消（completed/canceled 不可） |
| 108314 | NOTIFY_TASK_UNDO_EXPIRED | 撤销窗口已过 |
| 108315 | NOTIFY_TASK_NOT_PAUSED | 任务非暂停状态 |

### Commit 规范

```
feat(notification): <task summary>

Refs: docs/analysis/通知推送系统模块设计需求文档.md (V2 §6.6)
Plan: docs/superpowers/plans/2026-05-30-notification-p2-2-task-schedule.md (Task N)
```

### 测试策略

- scheduler 单测全部 mock BullMQ（不实际入队）；仅在 acceptance 阶段做 e2e
- rruleHelper 纯函数 jest 直接覆盖
- admin API 用 supertest

---

## Self-Review 备忘

P2.2 全部完成后写 [`2026-05-30-notification-p2-2-self-review.md`](./2026-05-30-notification-p2-2-self-review.md)，4 维自检：

1. **Spec coverage**：需求 §6.6 任务调度子节、§14.2.2 P1 验收清单 #4-7 全覆盖
2. **Placeholder scan**：grep `TBD/TODO/FIXME/待补充/实现略`，0 命中
3. **Type consistency**：`SendType` 联合类型 / `TaskStatus` 枚举 / 错误码常量名跨 Task 一致
4. **依赖闭环**：上方依赖图无环
