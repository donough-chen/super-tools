# 通知推送系统 P3.4 实施计划 — Self Review

> 适用：[`2026-07-11-notification-p3-4-sms-real-progress.md`](./2026-07-11-notification-p3-4-sms-real-progress.md)
> 4 维自检 + P3 阶段总结。

---

## 1. Spec Coverage

需求文档：§6.5（短信渠道）+ §6.4（Socket 实时推送）+ §14.2.3 队列监控（隐含）。

| # | 需求 | Task |
|---|---|---|
| 1 | 短信真实接入腾讯云 SMS | T3 |
| 2 | SmsAdapter 替换 P1 mock | T3 |
| 3 | 错误映射（quota/invalid mobile/down） | T3 `_mapError` |
| 4 | 大任务进度推送（>=1000 用户） | T4 |
| 5 | progress emit 到 admin:dashboard room | T4 `_emitProgress` |
| 6 | 队列监控（4 队列实时深度） | T5 + T6 |
| 7 | 失败任务重试按钮 | T5 + T6 |
| 8 | QueueDepthWidget 真实化（替换 P3.1 mock） | T6 |
| 9 | fallbackToLog 配置（开发用） | T1 + T3 |

**结论**：✅ 9 项全覆盖。

---

## 2. Placeholder Scan

| 命中 | 性质 |
|---|---|
| `'CHANGE_IN_PROD'`（SMS secret） | ✅ 配置占位（生产 admin 改） |
| `'12345'`（template_default） | ✅ 项目侧短信模板 ID 示例 |

✅ 0 真实占位。

---

## 3. Type Consistency

### 错误码

108730-108735 共 6 个，T1 实装。

### 接口

- `SmsAdapter.send(message)` 返回 `{ ok, providerResp? }` 与 P1/P2.1 EmailAdapter 形态对齐
- `task:progress` socket payload `{ taskId, processed, total, status, totalMessages? }` 在 T4 emit / admin UI on 一致
- `getXxxQueue(app)` 4 个 getter 形态一致；T5 service 与现有 P1/P2.2/P3.1 队列引用方式同
- `QUEUE_GETTERS` map key（send/task/export/schedule）在 T5 / T6 / API 路由三处一致

### 配置

`notification.{sms,progress,queueMonitor}` 三个新节点 T1 定义，T3/T4/T5/T6 使用。

**结论**：✅ 一致。

---

## 4. 依赖闭环

```
T1 → T2 → T3 ─┐
              ├─► T7
T1 → T4 ──────┤
              │
T1 → T5 → T6 ─┘
```

T3/T4/T5 并行（互不依赖）；T7 汇合。

**结论**：✅ 无环。

---

## 5. 风险与取舍

| 风险 | 处理 |
|---|---|
| 短信成本 | 频控（P2.1）+ 类型 quietPolicy=respect 限制；admin 可下调 channel.email/sms maxCount |
| 进度推送丢失 | 仅尽力而为；任务完成后客户端可主动查 task 详情 |
| 队列监控 5s 轮询压力 | BullMQ getJobCounts 轻量；Redis 单次 < 5ms |
| Redis 故障的页面体验 | 显示 DOWN 不阻塞；其他页面不受影响 |
| 重试失败 100 个上限 | 每次最多 100；多于此分多次操作 |

---

## 6. 自检结论

- ✅ Spec：9 项全覆盖
- ✅ Placeholder：0
- ✅ Type consistency：一致
- ✅ 闭环：无环

P3.4 计划可执行。

---

## 附：P3 阶段总结

| 子计划 | 范围 | Tasks | tag |
|--------|------|-------|-----|
| P3.1 | Stats + Widget + 导出 | 9 | p3-1-done |
| P3.2 | Schedule + alert | 7 | p3-2-done |
| P3.3 | 多 SMTP + i18n | 7 | p3-3-done |
| P3.4 | SMS 真实 + 进度推送 | 7 | p3-4-done + p3-done |
| **合计** | — | **30** | 5 tags |

---

## 附：通知模块 V2 全部计划完结

| 阶段 | Tasks | 关键 tag |
|------|-------|---------|
| P1 | 22 | p1-notification-done |
| P2 | 35 | p2-done |
| P3 | 30 | p3-done |
| **合计** | **87 Tasks** | 11 tags |

需求文档 + 全部计划 + 全部 self-review 已交付。下一步建议：选 P1 Task 1 启动实施（用 `executing-plans` / `subagent-driven-development` 技能）。
