# 通知推送系统 P2.4 实施计划 — Self Review

> 适用版本：[`2026-06-13-notification-p2-4-triggers-rollback.md`](./2026-06-13-notification-p2-4-triggers-rollback.md) + p2-4-01 ~ p2-4-07
> 撰写日期：2026-06-13
> Reviewer：plan author
> writing-plans skill 要求：spec coverage / placeholder scan / type consistency / 依赖闭环。

---

## 1. Spec Coverage（需求 → Task 映射）

### 1.1 来源

需求文档：V2 §11.2.5（工具上下架）+ §11.2.6（邀请）+ §11.2.7（积分）+ §10.2（模板版本 API）+ §11.1 触发点总览（14 项）。

### 1.2 章节 → Task 映射表

| # | 需求子项 | 覆盖 Task | 子文件 |
|---|---|---|---|
| 1 | 触发点 #3 会员升级 `BUSINESS_MEMBER_UPGRADE` | T3 | p2-4-03 |
| 2 | 触发点 #6 积分变动 `BUSINESS_POINTS_CHANGE` | T3 | p2-4-03 |
| 3 | 触发点 #11 工具上线 `BUSINESS_TOOL_PUBLISHED` | T5 | p2-4-05 |
| 4 | 触发点 #12 工具下架 `BUSINESS_TOOL_UNPUBLISHED` | T5 | p2-4-05 |
| 5 | 触发点 #14 邀请好友 `BUSINESS_INVITE_SUCCESS` | T4 | p2-4-04 |
| 6 | 模板版本快照（`notification_template_versions`，P1 已建表） | n/a（复用 P1） | — |
| 7 | 模板版本回滚 service | T2 | p2-4-02 |
| 8 | 模板版本 API（`/templates/:id/versions` + `/rollback`） | T2 | p2-4-02 |
| 9 | 模板版本 admin UI（版本树 + diff + 回滚按钮） | T6 | p2-4-06 |
| 10 | 工具上下架受众用 `favorite.tool_id`（依赖 P2.3） | T5 | p2-4-05 |
| 11 | 触发点容错（通知失败不影响业务） | T3/T4/T5 全部 try/catch + warn | p2-4-03/04/05 |

**结论**：✅ 5 触发点 + 模板回滚 6 个需求项全覆盖。

不做项（国际化 / 富文本编辑器 / schedule 触发 / admin 全局开关）已显式声明在 overview "❌ 不做"。

---

## 2. Placeholder Scan

扫描模式：`TBD | TODO | FIXME | XXX | 待补充 | 如有需要 | 待定 | 实现略 | 后续补充`。

| 命中 | 文件 | 性质 | 处理 |
|---|---|---|---|
| `'13800001111' / '13800002222'` 测试用号码 | p2-4-04 | ✅ 测试 fixture | 保留 |
| `'TEST_API_*' / 'tpl_rollback_test'` 测试隔离前缀 | p2-4-02 | ✅ | 保留 |
| `'CHANGE_IN_PROD'`（间接引用 P2.1 SMTP 占位） | n/a | ✅ 在 P2.1 中已声明 | 保留 |

**结论**：✅ 0 真实占位。

---

## 3. Type Consistency

### 3.1 错误码

| Task | 引用 | 是否定义 | 一致性 |
|---|---|---|---|
| T1 | 108120 NOTIFY_TEMPLATE_VERSION_NOT_FOUND / 108121 NOTIFY_TEMPLATE_ROLLBACK_SAME_VERSION | ✅ T1 自身实装 | ✅ |
| T2 | `NOTIF_ERR.TEMPLATE_VERSION_NOT_FOUND` / `TEMPLATE_ROLLBACK_SAME_VERSION` | ✅ | ✅ |
| T3-T5 触发点 | 不抛错（仅 warn 日志） | n/a | ✅ |

### 3.2 typeKey 一致性（5 业务类型，3 处声明必须完全一致）

| typeKey | T1 SQL seed | T3-T5 触发代码 | T3-T5 测试用例 |
|---|---|---|---|
| `member_upgrade`     | ✅ | T3 ctx.service.notification.send | T3 captured.typeKey 断言 |
| `points_change`      | ✅ | T3 同上 | T3 同上 |
| `invite_success`     | ✅ | T4 同上 | T4 同上 |
| `tool_published`     | ✅ | T5 sendByAudience | T5 同上 |
| `tool_unpublished`   | ✅ | T5 同上 | T5 同上 |

### 3.3 模板 params 一致性（SQL 模板 vs 触发代码 params）

| typeKey | SQL 模板用到的 {{var}} | T3-T5 触发代码传的 params 字段 | 一致性 |
|---|---|---|---|
| member_upgrade（inApp） | userName / levelName / expireAt | userName / levelName / upgradeAt / expireAt | ✅（多传 upgradeAt 给 email 模板用） |
| member_upgrade（email） | userName / upgradeAt / levelName / expireAt | 同上 | ✅ |
| points_change | action / amount / balance / reason | action / amount / balance / reason | ✅ |
| invite_success | inviteeName / rewardPoints | inviteeName / rewardPoints | ✅ |
| tool_published | toolName / toolUrl | toolName / toolUrl | ✅ |
| tool_unpublished | toolName / reason / alternativeUrl | toolName / reason / alternativeUrl | ✅ |

**结论**：✅ 5 个 typeKey 在 SQL 模板 + 触发代码 + 测试用例三处声明完全对齐；模板 {{var}} 与 params 字段一一对应。

### 3.4 业务 service 入口

| 触发 | 入口方法 | 复用 P1 service |
|---|---|---|
| 单用户场景（member/invite） | `ctx.service.notification.send(input)` | ✅ |
| 批量受众场景（tool） | `ctx.service.notification.sendByAudience(input)` | ✅ |

**结论**：✅ 复用 P1 已发布 API，无新增主入口。

---

## 4. 依赖闭环

```
T1 migration ─┬──► T2 rollback service ──► T6 admin-ui
              │
              ├──► T3 trigger-member ──┐
              │                        │
              ├──► T4 trigger-invite ──┼──► T7 acceptance
              │                        │
              └──► T5 trigger-tool ────┘
                            │
                            └──── 间接依赖 P2.3（已 done）的 audience compiler
```

**校验**：
- 无环；最长链 T1 → T2 → T6 → T7 = 4 跳（含 UI）
- T3/T4/T5 完全独立可并行
- T5 跨阶段依赖 P2.3，已在 overview 前置条件标注

**结论**：✅ 依赖闭环成立；P2.4 是 P2 中最易并行实施的子计划。

---

## 5. 风险与取舍

| 风险点 | 处理方式 |
|---|---|
| 触发点失败影响业务 | 全部 try/catch + warn，业务事务不回滚 |
| 积分变动通知骚扰 | 阈值 ≥ 50 + 重要 reason 白名单 |
| 工具下架找不到替代 | fallback `/tools` 主页 |
| 模板回滚误操作 | 二次确认 Modal + 复用 publishVersion 事务保证一致性 |
| 工具上线 1000+ 收藏者 | 复用 P2.3 EXISTS 子查询；audience 解析 ≤ 2s（acceptance 9.3） |
| 模板回滚到 active | 抛 108121 拒绝；UI 也禁用按钮 |
| 模板回滚后旧消息 | 已发出消息存 templateVersion 快照，不变；新消息用新 active |
| typeKey 命名风格 | 使用 snake_case（与 P1 已建 type 一致），需求文档常量名 BUSINESS_* 仅作模板编码引用 |

---

## 6. 验证产物预期

- **Git**：7 commits + 1 acceptance commit + **2 tags**（`p2-4-done` + `p2-done` 收尾整个 P2）
- **后端**：1 service 方法新增（rollbackToVersion）+ 5 处业务 service 触发代码 + 2 controller 方法 + 2 路由
- **DB**：迁移 022 含 5 type + 6 template seed + 2 errcodes
- **Admin**：1 Drawer（TemplateVersionDrawer）+ 1 Diff 视图 + 列表行新按钮
- **测试**：单元 ≥ 17 用例（4 rollback + 5 member + 2 invite + 4 tool + 2 重叠）+ e2e 10 acceptance

---

## 7. 自检结论

- ✅ **Spec coverage**：5 触发点 + 模板回滚 11 项需求全覆盖
- ✅ **Placeholder scan**：0 真实占位
- ✅ **Type consistency**：5 typeKey 三处声明（SQL/代码/测试）完全一致；模板 {{var}} 与触发 params 一一对应
- ✅ **依赖闭环**：7 任务拓扑无环；并行能力强（T3/T4/T5 同时实施）

**P2.4 计划可进入执行阶段；P2 阶段全部计划完结，建议 P2.4 acceptance 后打 `p2-done` 总 tag。**

---

## 附：P2 全阶段统一回顾

| 子计划 | 自检文件 | Tasks | tag |
|--------|---------|-------|-----|
| P2.1 频控/静默/邮件 | `2026-05-23-notification-p2-1-self-review.md` | 10 | p2-1-done |
| P2.2 任务调度 | `2026-05-30-notification-p2-2-self-review.md` | 9 | p2-2-done |
| P2.3 动态受众 | `2026-06-06-notification-p2-3-self-review.md` | 9 | p2-3-done |
| P2.4 触发点+回滚 | `2026-06-13-notification-p2-4-self-review.md`（本文件） | 7 | p2-4-done + p2-done |
| **合计** | 4 self-review | **35 Tasks** | 5 tags |

整个 P2 阶段实施完成后，即可进入 P3（看板 / widget / 国际化 / 多 SMTP / 短信真实接入）规划。
