# 通知推送系统 P2.2 实施计划 — Self Review

> 适用版本：[`2026-05-30-notification-p2-2-task-schedule.md`](./2026-05-30-notification-p2-2-task-schedule.md) + p2-2-01 ~ p2-2-09
> 撰写日期：2026-05-30
> Reviewer：plan author
> writing-plans skill 要求：spec coverage / placeholder scan / type consistency / 依赖闭环。

---

## 1. Spec Coverage（需求 → Task 映射）

### 1.1 来源

需求文档：V2 §6.6（任务调度）+ §14.2.2 P1 验收 #4-7。

### 1.2 章节 → Task 映射表

| # | 需求子项 | 覆盖 Task | 子文件 |
|---|---|---|---|
| 1 | sendType=immediate（30 秒撤销） | T5 + T8 | p2-2-05 / p2-2-08 |
| 2 | sendType=scheduled（一次性，min 30s） | T5 | p2-2-05 |
| 3 | sendType=cron（BullMQ repeatable） | T3 + T5 + T6 | p2-2-03 / p2-2-05 / p2-2-06 |
| 4 | sendType=rrule（delayed 链） | T3 + T5 + T6 | p2-2-03 / p2-2-05 / p2-2-06 |
| 5 | 任务暂停 / 恢复（cron removeRepeatable） | T5 + T7 | p2-2-05 / p2-2-07 |
| 6 | 任务取消（状态守卫） | T5 + T7 | p2-2-05 / p2-2-07 |
| 7 | 30 秒撤销窗口（删 BullMQ delayed job） | T5 + T7 | p2-2-05 / p2-2-07 |
| 8 | 应用重启恢复 cron / rrule | T6 | p2-2-06 |
| 9 | Stuck 任务自动 failed | T5 + T6 | p2-2-05 / p2-2-06 |
| 10 | admin API 4 端点（pause/resume/cancel/undo）+ 预览端点 | T7 | p2-2-07 |
| 11 | admin UI（4 sendType wizard + 4 操作按钮 + 倒计时） | T8 | p2-2-08 |
| 12 | §14.2.2 #4 任务定时准时触发 / #5 cron 周期 / #6 重启恢复 / #7 stuck | T9 | p2-2-09 |

**结论**：✅ 任务调度需求 12 项 100% 覆盖。

不做项（动态受众 UI / 任务进度推送 / 优先级队列）已在 overview "❌ 不做" 显式声明。

---

## 2. Placeholder Scan

扫描模式：`TBD | TODO | FIXME | XXX | 待补充 | 如有需要 | 待定 | 实现略 | 后续补充`。

| 命中 | 文件 | 性质 | 处理 |
|---|---|---|---|
| `*/2 * * * *` 调试用 cron | p2-2-09 | ✅ 验收手册的样例（不在代码中） | 保留 |
| `INTERVAL=2`（rrule 测试） | p2-2-09 | ✅ 同上 | 保留 |
| `TEST_SCH_*` / `TEST_BOOT_*` 测试隔离前缀 | p2-2-05 / p2-2-06 | ✅ | 保留 |

**结论**：✅ 0 真实占位。

---

## 3. Type Consistency

### 3.1 错误码

| Task | 引用错误码 | 是否定义 | 一致性 |
|---|---|---|---|
| T1 | 108310 ~ 108315（6 个新增）| ✅（T1 自身实装） | ✅ |
| T5 | `NOTIF_ERR.TASK_*` 6 个 | ✅ | ✅ |
| T7 | controller 透传 service 错误 | n/a | ✅ |

### 3.2 接口签名

| 接口 | 定义 | 引用 |
|---|---|---|
| `SendType = 'immediate'\|'scheduled'\|'cron'\|'rrule'` | p2-2-05 | p2-2-07 controller / p2-2-08 UI |
| `TaskStatus`（枚举：pending/scheduled/running/paused/completed/failed/canceled） | p2-2-02 SQL ENUM | p2-2-05 service / p2-2-08 UI 显示 |
| `ScheduleNewInput` | p2-2-05 | p2-2-07 controller body |
| `executeTrigger({task,trigger,fireAt})` | p2-2-04 worker → p2-2-05 service | ✅ |
| `TaskJobData {taskId, trigger, fireAt}` | p2-2-04 | p2-2-05 enqueue 调用 |
| `getTaskQueue(app)` | p2-2-04 | p2-2-05 / p2-2-06 |

### 3.3 配置 schema

| 节点 | 声明 | 引用 |
|---|---|---|
| `notification.task.{enabled, queueName, concurrency, minScheduleSec, undoWindowSec, stuckThresholdSec, stuckScanIntervalMs, rruleMaxFutureDays}` | p2-2-01 | p2-2-04 / p2-2-05 / p2-2-06 |

**结论**：✅ 类型/接口/配置三层在 9 子文件之间完全一致。

---

## 4. 依赖闭环

```
T1 deps-config
  ↓
T2 migration ─┬─► (T5 model 字段)
              │
T3 helpers ───┴─► T5 scheduler ─┬─► T6 boot
              │                  │
T4 queue ─────┘                  ├─► T7 admin-api
                                 │       │
                                 │       ↓
                                 │   T8 admin-ui
                                 │       │
                                 └───────┴─► T9 acceptance
```

**校验**：
- 无环；最长链 T1 → T2 → T5 → T7 → T8 → T9 = 6 跳
- T5 同时依赖 T3（helpers）+ T4（队列）+ T2（model）
- T6 boot 依赖 T5（调用 scanStuck）

**结论**：✅ 依赖图无环。

---

## 5. 风险与取舍

| 风险点 | 处理方式 |
|---|---|
| BullMQ repeat job 重启丢失 | T6 boot 启动时 add 一次（jobId 幂等） |
| rrule BYYEAR=9999 长跨度 | T1 配置 `rruleMaxFutureDays=365`；T5 用 `rruleHasFireWithin` 拒绝 |
| Stuck 误判 | 阈值 30 min；仅扫 status=running 且 startedAt < now-N |
| undo 窗口竞态（用户点撤销时 worker 正在执行） | worker 内 status=canceled 检查 + delayed job 删除双保险 |
| pause 后 cron 重新 add 时机 | resume 时 add；pause 期间 BullMQ 无 repeat job |

---

## 6. 验证产物预期

- **Git**：9 commits + 1 acceptance commit + 1 tag `p2-2-done`
- **后端**：1 新 service（scheduler）+ 2 lib（rrule/cron）+ 1 worker + 1 boot + 5 controller 方法
- **DB**：迁移 020 含 8 个新字段 + 2 索引 + 3 权限码
- **Admin**：4 个新组件（ScheduleTypeRadio / DateTimePicker / CronEditor / RRuleEditor）+ 详情 4 操作按钮
- **测试**：单元 ≥ 32 用例（18+5+4+2+3）+ e2e ≥ 6 + acceptance 10 场景

---

## 7. 自检结论

- ✅ **Spec coverage**：12 项需求全覆盖
- ✅ **Placeholder scan**：0 真实占位
- ✅ **Type consistency**：`SendType` / `TaskStatus` / 错误码常量名跨 9 子文件一致
- ✅ **依赖闭环**：9 任务拓扑无环；最长链 6 跳

**P2.2 计划可进入执行阶段。**
