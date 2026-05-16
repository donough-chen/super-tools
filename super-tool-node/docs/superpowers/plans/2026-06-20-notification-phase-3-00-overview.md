# 通知推送系统 Phase 3 实施计划总览（轻量化）

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement each sub-plan task-by-task.

**Goal:** 在 P1 主链路 + P2 防骚扰/调度/受众/触发点能力的基础上，把通知系统从"能跑"升级为"运营驱动 + 生产可观测"。

**Reference:** [通知推送系统模块设计需求文档（V2）](../../analysis/通知推送系统模块设计需求文档.md)

**前置条件**：P1 + P2.1 + P2.2 + P2.3 + P2.4 全部已合入 master，tag `p2-done` 存在。

---

## 写作风格说明

P3 采用 **轻量化单文件** 风格（不再拆 sub-task 文件）：
- 每份 P3.x 一个 markdown 文件，文件内顺序列出全部 Tasks，每 Task 含 Steps + 代码示例 + 验证 + commit
- 与 P1/P2 拆分风格的差异仅是文件组织；实施步骤、TDD 模式、commit 粒度保持一致
- 之所以采取此风格：P3 4 个子计划工程量比 P1/P2 小，单文件可读性更佳

---

## P3 范围（4 份独立计划）

| 编号 | 子计划文件 | 范围 | Tasks | 工程量 |
|------|------------|------|-------|--------|
| **P3.1** | [`2026-06-20-notification-p3-1-stats-dashboard.md`](./2026-06-20-notification-p3-1-stats-dashboard.md) | Stats 数据看板 + 5 个 Dashboard widget + 异步导出 | 9 | L |
| **P3.2** | [`2026-06-27-notification-p3-2-member-schedule-alert.md`](./2026-06-27-notification-p3-2-member-schedule-alert.md) | Member 到期 schedule（提前 7/3/1 天）+ 数据清理 schedule + Stuck 增强 + alert 对接 | 7 | M |
| **P3.3** | [`2026-07-04-notification-p3-3-multi-smtp-i18n.md`](./2026-07-04-notification-p3-3-multi-smtp-i18n.md) | 多 SMTP 自动切换（健康检查 + 故障转移）+ 模板国际化 i18n（zh-CN / en-US） | 7 | M |
| **P3.4** | [`2026-07-11-notification-p3-4-sms-real-progress.md`](./2026-07-11-notification-p3-4-sms-real-progress.md) | 短信真实接入（腾讯云 SMS）+ 大任务进度推送（>1000 用户）+ 队列监控页 | 7 | M |

> 总计 30 Tasks ≈ 4 周（1 后端 + 0.5 前端）。

---

## 子计划之间的依赖

```
P2 (done)
  ↓
P3.1（Stats + Widget + 导出）── 复用 messages/send_logs，独立 stats service
  ↓
P3.2（Schedule + alert）────── 复用 P2.2 cron，新增 4 个 schedule 任务
  ↓
P3.3（多 SMTP + i18n）──────── 改造 P2.1 mail.ts + P1 templateRenderer
  ↓
P3.4（SMS 真实 + 进度推送）── 改造 P1 SmsAdapter + 新增 progress 队列
```

---

## 共享前提

### 错误码段位

| 段位 | 子计划 | 用途 |
|------|--------|------|
| 108700-108705 | P3.1 | 统计/导出 |
| 108710-108715 | P3.2 | schedule |
| 108720-108725 | P3.3 | 多 SMTP / i18n |
| 108730-108735 | P3.4 | 短信真实 / 进度推送 |

### DB 迁移编号

| 迁移 | 子计划 |
|------|--------|
| 023 | P3.1 |
| 024 | P3.2 |
| 025 | P3.3 |
| 026 | P3.4 |

### Commit 规范

```
feat(notification): <task summary>

Refs: docs/analysis/通知推送系统模块设计需求文档.md (V2 §X.Y)
Plan: docs/superpowers/plans/<sub-plan-file>.md (Task N)
```

---

## 执行顺序

```
Week 1   P3.1（Stats + Widget + 导出）   ──► tag p3-1-done
Week 2   P3.2（Schedule + alert）        ──► tag p3-2-done
Week 3   P3.3（多 SMTP + i18n）          ──► tag p3-3-done
Week 4   P3.4（SMS 真实 + 进度推送）     ──► tag p3-4-done → tag p3-done（P3 完结）
```

---

## Self-Review

每份子计划写完后做一次 4 维自检（spec / placeholder / type / dependency），输出独立的 `*-self-review.md`：

- [`2026-06-20-notification-p3-1-self-review.md`](./2026-06-20-notification-p3-1-self-review.md)
- [`2026-06-27-notification-p3-2-self-review.md`](./2026-06-27-notification-p3-2-self-review.md)
- [`2026-07-04-notification-p3-3-self-review.md`](./2026-07-04-notification-p3-3-self-review.md)
- [`2026-07-11-notification-p3-4-self-review.md`](./2026-07-11-notification-p3-4-self-review.md)

---

## 当前 plans 目录

```
docs/superpowers/plans/
├── P1（14 文件，含 self-review）
├── P2（44 文件，含 4 self-review）
│
├── 2026-06-20-notification-phase-3-00-overview.md   ◄ 本文件
├── 2026-06-20-notification-p3-1-stats-dashboard.md       ◄ 待写
├── 2026-06-27-notification-p3-2-member-schedule-alert.md ◄ 待写
├── 2026-07-04-notification-p3-3-multi-smtp-i18n.md       ◄ 待写
└── 2026-07-11-notification-p3-4-sms-real-progress.md     ◄ 待写
+ 4 self-review
```
