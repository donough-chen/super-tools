# 通知推送系统 P3.2 实施计划 — Self Review

> 适用：[`2026-06-27-notification-p3-2-member-schedule-alert.md`](./2026-06-27-notification-p3-2-member-schedule-alert.md)
> 4 维自检。

---

## 1. Spec Coverage

需求文档：§11.2.7（积分/会员）+ §11.2.8（alert）+ §6.6（schedule）+ §4.2.6 messages 保留策略。

| # | 需求 | Task |
|---|---|---|
| 1 | 会员到期提前 7/3/1 天提醒 | T4 memberExpireSoon |
| 2 | messages 90 天清理 | T4 cleanupMessages |
| 3 | send_logs 30 天清理 | T4 cleanupSendLogs |
| 4 | 导出文件 7 天过期清理 | T4 cleanupExports |
| 5 | alert 系统对接（超管收通知） | T6 |
| 6 | schedule 启动恢复 | T5 boot 集成 |
| 7 | Stuck 扩展到 export jobs | T5 |
| 8 | admin schedules 列表 + 暂停/恢复 | T6 admin API/UI |
| 9 | 幂等键防止重复（`member-expire-soon-{user_id}-{YYYYMMDD}-{Nd}`）| T4 实现 |

**结论**：✅ 9 项需求全覆盖。

---

## 2. Placeholder Scan

`TEST_*` 仅在测试中。其余 `CHANGE_IN_PROD`（继承 P2.1 SMTP 占位）已说明。

✅ 0 真实占位。

---

## 3. Type Consistency

### 错误码

108710-108715 共 6 个，T1 实装；T3 service / T4 各 handler 引用 `NOTIF_ERR.SCHEDULE_*` / `MEMBER_EXPIRE_NO_TARGET` / `CLEANUP_FAILED` 一致。

### 接口

- `notification_schedules` 表字段（code/name/handler/cron_expr/enabled/params/lastFireAt/lastStatus/lastMessage/nextFireAt）三处一致：T2 SQL、T3 service、T6 controller
- `registerScheduleHandler(key, fn)` 注册函数签名在 T3 定义、T4 全部 handler 使用
- 4 个 handler key（memberExpireSoon / cleanupMessages / cleanupSendLogs / cleanupExports）在 T2 SQL seed / T4 注册 / T6 list 三处一致

### 配置

`notification.schedule.{enabled,queueName,presets.*}` 在 T1 声明，T3/T4 使用。

**结论**：✅ 一致。

---

## 4. 依赖闭环

```
T1 → T2 → T3 → T4 ─┐
                   ├─► T5 boot ─► T6 alert+API → T7
                   └─────────────►
```

无环；最长链 6 跳。

**结论**：✅ 闭环成立。

---

## 5. 风险与取舍

| 风险 | 处理 |
|---|---|
| 会员到期重复通知 | 幂等键 `member-expire-soon-{user_id}-{YYYYMMDD}-{Nd}` 通过 bizRefType+bizRefId 检查 |
| 数据清理 SQL 锁表 | DELETE LIMIT 50000 + 索引；每次最多删 5w 行 |
| schedule handler 全局状态 | 用 module-scoped HANDLERS map；测试时需要清理 |
| alert 风暴 | 同一 alert.id 仅触发一次（bizRefId 防重） |
| 超管列表查询性能 | 复杂 JOIN；超管数量小（<10），不优化 |

---

## 6. 自检结论

- ✅ Spec：9 项全覆盖
- ✅ Placeholder：0
- ✅ Type consistency：一致
- ✅ 依赖闭环：6 跳无环

P3.2 计划可执行。
