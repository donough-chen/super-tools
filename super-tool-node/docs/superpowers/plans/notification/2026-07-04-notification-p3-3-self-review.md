# 通知推送系统 P3.3 实施计划 — Self Review

> 适用：[`2026-07-04-notification-p3-3-multi-smtp-i18n.md`](./2026-07-04-notification-p3-3-multi-smtp-i18n.md)
> 4 维自检。

---

## 1. Spec Coverage

需求文档：§6.5（多 SMTP 切换）+ §8.8（i18n）。

| # | 需求 | Task |
|---|---|---|
| 1 | 邮件多 SMTP 自动切换（按 priority 排序） | T2 |
| 2 | SMTP 健康检查（5 分钟一次） | T3 |
| 3 | 全 provider down 抛 108720 | T2 |
| 4 | 模板按 user.lang 选 + zh-CN fallback | T4 |
| 5 | C 端 API 切换语言偏好 | T5 |
| 6 | admin Templates UI 加 lang 过滤 + 复制按钮 | T6 |
| 7 | 不支持的 lang → 108722 | T1 + T5 |
| 8 | 健康检查复用 P3.2 schedule 框架 | T3 |

**结论**：✅ 8 项全覆盖。

---

## 2. Placeholder Scan

`CHANGE_IN_PROD`（SMTP 密码）仅 P2.1/P3.4 配置，本计划仅涉及备 SMTP 配置示例（继承同样占位）。

`TEST_*` 测试隔离。

✅ 0 真实占位。

---

## 3. Type Consistency

### 错误码

108720-108723 共 4 个，T1 实装；T2/T4/T5 一致引用。

### 接口

- `MailService.sendOnce` 返回 `{ messageId, provider: number }`（P3.3 新加 `provider`）；T2 service / SmsAdapter 不变（不涉及）
- `ProviderEntry { configId, priority, signature, transport, lastHealthOk }` 在 T2 内部
- `users.lang` 字段（zh-CN / en-US）在 T1 SQL / T4 service / T5 controller 三处一致

### 配置

`notification.mail.transport.*` P2.1 已有；P3.3 仅扩展 channel_config 表读多条，不改 config schema。

**结论**：✅ 一致。

---

## 4. 依赖闭环

```
T1 → T2 → T3 → T7
T1 → T4 → T5 → T6 → T7
```

T2、T4 并行（多 SMTP 与 i18n 互不依赖）；T7 汇合验收。

**结论**：✅ 无环。

---

## 5. 风险与取舍

| 风险 | 处理 |
|---|---|
| 主备同时 down | 抛 108720，BullMQ attempts=3 重试，1 小时后健康检查恢复后再发 |
| transport pool 与 reload 竞态 | 静态 `_loaded` flag + reload 强制清空 |
| user.lang 缺失 | 默认 'zh-CN'；不抛错 |
| en-US 模板缺失 | fallback zh-CN（不抛错），日志记录 |
| 切换 lang 后历史消息不变 | 历史消息已渲染落库，不回填 |

---

## 6. 自检结论

- ✅ Spec：8 项全覆盖
- ✅ Placeholder：0
- ✅ Type consistency：一致
- ✅ 闭环：无环

P3.3 计划可执行。
