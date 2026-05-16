# 通知推送系统 P3.1 实施计划 — Self Review

> 适用版本：[`2026-06-20-notification-p3-1-stats-dashboard.md`](./2026-06-20-notification-p3-1-stats-dashboard.md)
> 撰写日期：2026-06-20
> writing-plans skill 要求：spec coverage / placeholder scan / type consistency / 依赖闭环。

---

## 1. Spec Coverage

需求文档 V2 引用：§8.2 页面文件结构、§8.5 Dashboard widget 注册、§14.2.3 P3 验收清单。

| # | 需求子项 | 覆盖 Task |
|---|---|---|
| 1 | Stats overview/trend/by-channel/by-type/funnel 5 类查询 | T3 |
| 2 | 5 类 Dashboard widget（unread/trend7d/channelDist/topTypes/queueDepth） | T8 |
| 3 | 异步导出（BullMQ + xlsx + 邮件接收） | T4 + T5 |
| 4 | admin Stats 4 Tab 页面 | T7 |
| 5 | 90 天统计窗口限制 | T3 `_guardRange` |
| 6 | 5 分钟统计缓存 | T3 `_cached` |
| 7 | 文件 7 天过期 | Task 1 config + Task 5 expiresAt |
| 8 | §14.2.3 #1-3 验收（看板/widget/导出） | T9 |

**结论**：✅ 8 项 P3.1 范围内需求全覆盖。

---

## 2. Placeholder Scan

| 命中 | 文件 | 性质 |
|---|---|---|
| `'TEST_EXP_*'` 测试隔离 | T5 | ✅ 测试 fixture |

**结论**：✅ 0 真实占位。

---

## 3. Type Consistency

### 3.1 错误码

108700-108705 共 6 个，T1 实装；T3 / T5 引用 `NOTIF_ERR.STATS_RANGE_TOO_LARGE / EXPORT_*` 一致。

### 3.2 接口

- `Range { from: Date; to: Date }` 在 T3 service / T6 controller 一致
- `Trend granularity = 'day'\|'hour'` 跨层一致
- `notif.export` 队列名在 T1 config / T5 worker / T5 service 三处一致
- `notification_export_jobs.status` enum: pending/running/completed/failed/expired 在 T2 SQL / T5 service / T6 controller 一致

### 3.3 配置

`notification.stats.{cacheMs,queryTimeoutMs,maxRangeDays}` + `notification.export.{queueName,concurrency,maxRows,fileTtlDays,storageDir}` 在 T1 声明，T3/T5/T6 使用。

**结论**：✅ 跨 Task 一致。

---

## 4. 依赖闭环

```
T1 → T2 → T3 ─┐
              ├─► T6 → {T7, T8} → T9
T1 → T4 → T5 ─┘
```

无环；最长链 T1 → T2 → T3 → T6 → T7 → T9 = 6 跳。

**结论**：✅ 闭环成立。

---

## 5. 风险与取舍

| 风险 | 处理 |
|---|---|
| 大表 stats 慢查询 | created_at 索引 + 90d 上限 + 5min 缓存 |
| 10 万行导出内存 | xlsx 分批写（实际 100k 行 ~50MB，可接受；P4 可改流式） |
| 文件存储路径 | run/exports 默认；生产由 `EXPORT_STORAGE_DIR` 覆盖 |
| 邮件附件大小 | 邮件不附 xlsx，用下载链接（避免超 SMTP 限额） |

---

## 6. 自检结论

- ✅ Spec coverage：8 项全覆盖
- ✅ Placeholder：0
- ✅ Type consistency：一致
- ✅ 依赖闭环：6 跳无环

P3.1 计划可执行。
