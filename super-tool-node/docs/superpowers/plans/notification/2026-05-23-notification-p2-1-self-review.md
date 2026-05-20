# 通知推送系统 P2.1 实施计划 — Self Review

> 适用版本：[`2026-05-23-notification-p2-1-rate-quiet-mail.md`](./2026-05-23-notification-p2-1-rate-quiet-mail.md) + p2-1-01 ~ p2-1-10
> 撰写日期：2026-05-23
> Reviewer：plan author（写完即自检）
> writing-plans skill 要求：spec coverage / placeholder scan / type consistency / 依赖闭环。

---

## 1. Spec Coverage（需求 → Task 映射）

### 1.1 来源

需求文档：[`通知推送系统模块设计需求文档.md`](../../analysis/通知推送系统模块设计需求文档.md)（V2）

P2.1 范围对应章节：
- §6.5（渠道适配器：邮件 nodemailer）
- §7.1 ~ §7.5（频控 / 静默 / 优先级矩阵 / 端到端跟踪 / 跳过原因）
- §7.7（频控规则预置）
- §7.8（全局静默配置）

### 1.2 章节 → Task 映射表

| # | 需求章节 / 子项 | 覆盖 Task | 子文件 |
|---|---|---|---|
| 1 | §6.5 EmailAdapter（nodemailer）| T5 + T6 | p2-1-05 / p2-1-06 |
| 2 | §7.1 主决策算法（顺序：偏好 → 静默 → 频控）| T7 | p2-1-07 |
| 3 | §7.2 静默窗口判定（含跨夜 + 时区） | T3 | p2-1-03 |
| 4 | §7.3 频控 Redis Key 与 Lua 脚本（4 scope）| T4 | p2-1-04 |
| 5 | §7.4 优先级矩阵（quietHourPolicy: respect/bypass/relax）| T2 + T3 | p2-1-02 / p2-1-03 |
| 6 | §7.5 端到端跟踪（send_log 写 skipped 原因 + extra）| T2 + T7 | p2-1-02 / p2-1-07 |
| 7 | §7.6 跳过原因枚举 `quiet_hour` / `rate_limited:*` | T7 | p2-1-07 |
| 8 | §7.7 频控规则预置（5 条）| T2 | p2-1-02 |
| 9 | §7.8 全局静默 / 类型级 quietHourPolicy | T2 | p2-1-02 |
| 10 | §8.5 admin Configs 模块（频控/渠道）| T8 + T9 | p2-1-08 / p2-1-09 |
| 11 | §14.2.2 P1 验收清单 #1-3（频控配置 5 分钟生效 / 邮件真实发送 / 静默生效）| T10 | p2-1-10 |

**结论**：✅ P2.1 范围内全部需求节均有 Task 覆盖。无缺漏项。

P2.1 显式声明的不做项（任务定时 / 动态受众 / 多 SMTP / 短信真实 / 模板回滚 UI）已在 overview "❌ 不做" 表中标注，分配到 P2.2 / P2.3 / P2.4 / P3。

---

## 2. Placeholder Scan

扫描模式：`TBD | TODO | FIXME | XXX | 待补充 | 如有需要 | 待定 | 实现略 | 后续补充`，范围 p2-1-*.md + 总览。

| 命中 | 文件 | 性质 | 处理 |
|---|---|---|---|
| `'CHANGE_IN_PROD'`（SMTP 默认密码占位） | p2-1-01 / p2-1-02 | ✅ 配置示例占位（生产由 admin 改） | 保留 |
| `'TEST_*'` 测试数据 description | p2-1-04 / p2-1-08 | ✅ 测试隔离前缀 | 保留 |

**结论**：✅ 无真实未填充占位（无 TBD/TODO/待补充/实现略）。

---

## 3. Type Consistency

### 3.1 错误码

| Task | 引用错误码 | 在 errcodes 是否定义 | 一致性 |
|---|---|---|---|
| T1 | 108502 / 108503 / 108602 message 实装 | ✅（P1 已占位，T1 仅核对 message） | ✅ |
| T5 | `NOTIF_ERR.EMAIL_SEND_FAILED` (108602) | ✅ | ✅ |
| T6 | `NOTIF_ERR.EMAIL_SEND_FAILED` 抛错路径 | ✅ | ✅ |
| T7 | `quiet_hour` / `rate_limited:*` 写入 send_log（字符串 marker，非错误码） | n/a | ✅ |
| T8 | `NOTIF_ERR.AUDIENCE_NOT_FOUND` 用作 not_found 占位 | ⚠ 见下 |
| T8 | `NOTIF_ERR.CHANNEL_CONFIG_INVALID` (108601) | ✅ | ✅ |

**已知折中**：T8 `update/destroy rate-limit` 没找到时复用了 `NOTIF_ERR.AUDIENCE_NOT_FOUND`（108210），语义不严谨。**Follow-up**：执行 Task 8 时如果觉得不优雅，可在 errorCodes 加 `NOTIFY_RATE_LIMIT_NOT_FOUND (108520)`，本计划不强制。

### 3.2 接口签名

| 接口 | 定义文件 | 引用文件 | 一致性 |
|---|---|---|---|
| `RateRule { id, scope, typeId, channel, windowSeconds, maxCount }` | p2-1-04 实现 | p2-1-08 admin API 入参 | ✅ |
| `CheckInput / CheckResult` | p2-1-04 | p2-1-07 send 调用 | ✅ |
| `MailService.sendOnce(input)` 形态 | p2-1-05 | p2-1-06 EmailAdapter 调 / p2-1-08 SMTP 测试 | ✅ |
| `notification.task` 队列名 | n/a（P2.1 不引入此队列） | — | n/a |

### 3.3 配置 schema

| 配置节点 | 声明位置 | 引用 |
|---|---|---|
| `notification.rateLimit.{enabled,redisKeyPrefix,defaults}` | p2-1-01 | p2-1-04 service |
| `notification.quietHours.{enabled,defaultTimezone}` | p2-1-01 | p2-1-03 service |
| `notification.mail.{enabled,from,transport.*}` | p2-1-01 | p2-1-05 service |
| `notification.frontend.{h5BaseUrl,pcBaseUrl}` | p2-1-01 | p2-1-06 unsubscribe URL |

**结论**：✅ 跨 Task 类型/字段/常量一致。1 处轻度折中（T8 错误码复用），已标注 follow-up。

---

## 4. 依赖闭环（拓扑排序）

按 overview 依赖关系：

```
T1 deps-config
  ↓
T2 migration ─┬─► T3 quiet-hours
              │
              └─► T4 rate-limit ──┐
                                  ↓
T1 ─► T5 mail ─► T6 email-adapter ┤
                                  ↓
                           T7 send-integration
                                  │
                                  ├─► T8 admin-api
                                  │       │
                                  │       ↓
                                  │   T9 admin-ui
                                  │       │
                                  └───────┴─► T10 acceptance
```

**校验**：
- 拓扑排序无环；最长链 T1 → T2 → T4 → T7 → T8 → T9 → T10 = 7 跳
- 每个 Task 的 `前置` 字段与上图箭头一致
- T7 同时依赖 T3 + T4（两路汇合于 send 主链路）；T9 依赖 T8（API 先于 UI）

**结论**：✅ 依赖图无环且与子文件 `前置` 声明一致。

---

## 5. 风险与已声明取舍

| 风险点 | 处理方式 |
|---|---|
| Lua 脚本 NOSCRIPT 错误 | T4 内置 EVAL 自动 fallback + SHA 缓存 |
| 频控规则缓存陈旧 | invalidateCache() 在 admin 写时调用；最坏 5 min |
| 静默 timezone 边界 | 用 `Intl.DateTimeFormat`，跨夜窗口分支处理 |
| nodemailer 池连接耗尽 | maxConnections=5 + maxMessages=100；BullMQ 重试缓冲 |
| 邮件失败死循环 | EmailAdapter 抛 108602 → BullMQ attempts=3 后写 send_log failed |
| send_log.message_id 收紧 | T2 改为 NULLABLE 支持"未入库就被跳过"的日志 |
| Promise.race 超时不打断 SQL | 仅 SMTP 测试场景影响小；文档已注明 P3 改 SQL 层 hint |

---

## 6. 验证产物预期

执行完 P2.1 10 个 Task 后应得：

- **Git**：10 commits + 1 acceptance commit + 1 tag `p2-1-done`
- **后端**：3 个新 service（rate-limit / quiet-hours / mail）+ 1 个真实 EmailAdapter + 2 个 lib + 2 个 admin controller
- **DB**：迁移 019 含 `quietHourPolicy / rate config 5 字段 / channel SMTP 字段 / send_log NULLABLE` + 5 频控规则 + 1 SMTP 默认 + 2 权限码
- **Admin**：2 页（RateLimit / Channels）+ SMTP 测试按钮
- **测试**：单元 ≥ 75% 覆盖；e2e 10 场景全过

---

## 7. 自检结论

- ✅ **Spec coverage**：需求 §6.5 / §7.1-§7.8 / §8.5 / §14.2.2 #1-3 全覆盖
- ✅ **Placeholder scan**：0 个真实未填充占位
- ✅ **Type consistency**：错误码 / 接口 / 配置 schema 三层一致；含 1 处 T8 错误码复用 follow-up
- ✅ **依赖闭环**：10 任务拓扑无环；最长链 7 跳

**P2.1 计划可进入执行阶段。** 推荐使用 `subagent-driven-development` 技能按 Task 顺序执行，每个 Task 完成后单独 commit。
