# 通知推送系统 Phase 2 实施计划总览

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement each sub-plan task-by-task.

**Goal:** 在 P1 主链路打通的基础上，补齐"防骚扰能力 / 真实邮件渠道 / 任务调度 / 动态受众 / 新触发点 / 版本回滚 UI"五大类增强，让通知系统具备生产环境实际投放条件。

**Reference:** [通知推送系统模块设计需求文档（V2）](../../analysis/通知推送系统模块设计需求文档.md)

**前置条件**：P1 验收清单（22 项）全部通过 → tag `p1-notification-done`。

---

## P2 范围（按方案 B 拆 4 份独立计划）

每份子计划"自洽"：单独发布、单独验收、单独回滚。子计划之间在主分支按时间顺序执行，避免数据库迁移冲突。

| 编号 | 子计划文件 | 范围 | 工程量 | 可独立上线 |
|------|------------|------|--------|------------|
| **P2.1** | [`2026-05-23-notification-p2-1-rate-quiet-mail.md`](./2026-05-23-notification-p2-1-rate-quiet-mail.md) | 频控（a）+ 静默时段（b）+ 邮件真实发送（c） | M+S+M | ✅ |
| **P2.2** | [`2026-05-30-notification-p2-2-task-schedule.md`](./2026-05-30-notification-p2-2-task-schedule.md) | 任务定时（scheduledAt + Cron + RRULE）+ 暂停/取消/30 秒撤销 + Stuck 任务恢复 | L | ✅ |
| **P2.3** | [`2026-06-06-notification-p2-3-dynamic-audience.md`](./2026-06-06-notification-p2-3-dynamic-audience.md) | 动态受众规则解析引擎 + admin 可视化规则编辑器 + 受众预览/统计 | L | ✅ |
| **P2.4** | [`2026-06-13-notification-p2-4-triggers-rollback.md`](./2026-06-13-notification-p2-4-triggers-rollback.md) | 新触发点（邀请好友/工具上下架/会员升级/积分变动）+ 模板版本回滚 UI | M | ✅ |

> 总计预估 ~5 周（1 后端 + 0.5 前端，串行执行）；可并行的话压缩到 ~3 周。

### 子计划之间的依赖与隔离

```
P1 (done)
  ↓
P2.1（频控/静默/邮件）── 独立 service，与 P1 send 主入口耦合点 1 处
  ↓
P2.2（任务调度）────── 独立 BullMQ delayed/repeat job，与 P1 task model 加 6 字段
  ↓
P2.3（动态受众）────── 独立 audience-rule-engine + admin RuleBuilder 组件
  ↓
P2.4（触发点 + 回滚）── 依赖 P2.1（频控）已就绪、P1 模板版本表已建
```

> **数据库迁移编号**：P2.1=019, P2.2=020, P2.3=021, P2.4=022。每份计划只新增 / 改一个迁移文件，便于独立回滚。

---

## P2 共享前提（所有子计划遵守）

### 1. 错误码段位

P2 继续使用 P1 已开辟的 108xxx 段，按子模块约定子段：

| 段位 | P2 子计划 | 用途 |
|------|----------|------|
| 108502 | P2.1 | 命中频控（已在 P1 errorCodes 占位，P2.1 实装逻辑） |
| 108503 | P2.1 | 命中静默时段（同上） |
| 108602 | P2.1 | 邮件发送失败 |
| 108303-108304 | P2.2 | 任务定时 / Cron 校验 |
| 108310-108315 | P2.2 | 任务暂停/取消/撤销/恢复 |
| 108211-108212 | P2.3 | 受众规则字段/操作符校验 |
| 108220-108229 | P2.3 | 受众预览相关 |
| 108112 | P2.4 | 模板版本相关已在 P1 |
| 108120-108125 | P2.4 | 模板回滚相关 |

### 2. Commit 规范

每个 Task 一次 commit，message 格式：

```
feat(notification): <task summary in english>

<optional body>

Refs: docs/analysis/通知推送系统模块设计需求文档.md (V2 §X.Y)
Plan: docs/superpowers/plans/<sub-plan-file>.md (Task N)
```

### 3. 验收门禁

每份子计划末尾必须包含：

- [ ] 单元测试覆盖率 ≥ 75%（P2 比 P1 提高 5 个百分点）
- [ ] 新增能力的 e2e 验收清单 ≥ 5 个场景
- [ ] DB 迁移可正常 up & rollback（在干净库验证）
- [ ] 错误码不与 P1 段位冲突
- [ ] 自检文档 `<sub-plan>-self-review.md`

---

## 执行顺序建议

```
Week 1  P2.1（频控 + 静默 + 邮件） ──────► tag p2-1-done
Week 2  P2.2（任务调度）         ──────► tag p2-2-done
Week 3  P2.3（动态受众）         ──────► tag p2-3-done
Week 4  P2.4（新触发点 + 回滚）  ──────► tag p2-2-done → P2 完结 → 进入 P3
```

> P3 范围（不在本批次）：数据看板 / dashboard widget / 大批量进度推送 / 多 SMTP 切换 / 短信真实接入完善 / 模板国际化 / member 升级与积分细化。

---

## Self-Review 入口

每份子计划写完后做一次自检，输出独立的 `*-self-review.md`；本 overview 文件不再做汇总自检。

- [`2026-05-23-notification-p2-1-self-review.md`](./2026-05-23-notification-p2-1-self-review.md)
- [`2026-05-30-notification-p2-2-self-review.md`](./2026-05-30-notification-p2-2-self-review.md)
- [`2026-06-06-notification-p2-3-self-review.md`](./2026-06-06-notification-p2-3-self-review.md)
- [`2026-06-13-notification-p2-4-self-review.md`](./2026-06-13-notification-p2-4-self-review.md)

---

## 当前文件夹索引

```
docs/superpowers/plans/
├── 2026-05-16-notification-phase-1-00-overview.md      # P1 总览
├── 2026-05-16-notification-phase-1-self-review.md      # P1 自检
├── p1-01-deps-config.md ... p1-12-frontend-acceptance.md
│
├── 2026-05-23-notification-phase-2-00-overview.md      # 本文件
├── 2026-05-23-notification-p2-1-rate-quiet-mail.md     ◄ 已写
├── 2026-05-30-notification-p2-2-task-schedule.md       ◄ 待写
├── 2026-06-06-notification-p2-3-dynamic-audience.md    ◄ 待写
└── 2026-06-13-notification-p2-4-triggers-rollback.md   ◄ 待写
```

> 请按编号顺序阅读和执行。每份子计划独立可读，无需先读总览（但建议先读总览了解全局）。
