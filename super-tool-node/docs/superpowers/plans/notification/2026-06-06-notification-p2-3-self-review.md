# 通知推送系统 P2.3 实施计划 — Self Review

> 适用版本：[`2026-06-06-notification-p2-3-dynamic-audience.md`](./2026-06-06-notification-p2-3-dynamic-audience.md) + p2-3-01 ~ p2-3-09
> 撰写日期：2026-06-06
> Reviewer：plan author
> writing-plans skill 要求：spec coverage / placeholder scan / type consistency / 依赖闭环。

---

## 1. Spec Coverage（需求 → Task 映射）

### 1.1 来源

需求文档：V2 §4.2.4（dynamic_rules JSON 结构 + 字段白名单）+ §5.3（audience service）+ §8 admin 模块。

### 1.2 章节 → Task 映射表

| # | 需求子项 | 覆盖 Task | 子文件 |
|---|---|---|---|
| 1 | dynamic_rules JSON 结构（operator + conditions） | T4 compiler | p2-3-04 |
| 2 | 字段白名单 9 个（user / member / role / device / favorite） | T3 + T4 | p2-3-03 / p2-3-04 |
| 3 | 9 个操作符（eq/ne/gt/gte/lt/lte/in/nin/between） | T4 | p2-3-04 |
| 4 | 相对时间 P{N}D / P{N}H / P{N}M / PT{N}M | T2 + T4 | p2-3-02 / p2-3-04 |
| 5 | 嵌套深度 ≤ 3 层 | T4（内置 maxDepth）+ T7（UI 强制） | p2-3-04 / p2-3-07 |
| 6 | 一对多字段用 EXISTS（role/device/favorite） | T3 + T4 | p2-3-03 / p2-3-04 |
| 7 | 受众解析（dynamic 真实化） | T5 audience service | p2-3-05 |
| 8 | 受众预览（前 100 sample + 总数） | T5 + T6 | p2-3-05 / p2-3-06 |
| 9 | 可复用受众分组（notification_audiences 表 + CRUD） | T1 + T6 | p2-3-01 / p2-3-06 |
| 10 | admin RuleBuilder 组件（嵌套 AND/OR） | T7 | p2-3-07 |
| 11 | Tasks Wizard 接入动态受众 + 已保存分组 | T8 | p2-3-08 |
| 12 | 字段下拉来自后端 meta API（前后端一致） | T6 + T7 | p2-3-06 / p2-3-07 |

**结论**：✅ 需求 §4.2.4 + §5.3 全覆盖。

不做项（字段白名单运行时配置 / 嵌套 > 3 层 / 跨 DB / 缓存 / 导出 / A/B test）已显式声明在 overview "❌ 不做"。

---

## 2. Placeholder Scan

扫描模式：`TBD | TODO | FIXME | XXX | 待补充 | 如有需要 | 待定 | 实现略 | 后续补充`。

| 命中 | 文件 | 性质 | 处理 |
|---|---|---|---|
| `'TEST_AUD_*' / 'TEST_DYN'` 测试隔离前缀 | p2-3-05 / p2-3-06 | ✅ 测试 | 保留 |
| `'no_email' 'oops' 'boom'` 测试反例字符串 | p2-3-04 / p2-3-05 | ✅ 测试 | 保留 |

**结论**：✅ 0 真实占位。

---

## 3. Type Consistency

### 3.1 错误码

| Task | 引用 | 是否定义 | 一致性 |
|---|---|---|---|
| T1 | 108211/108212/108220/108221/108222 | ✅ T1 自身实装 | ✅ |
| T4 | `BIZ_ERR(108211)` 等 | ✅ | ✅ |
| T5 | `NOTIF_ERR.AUDIENCE_PREVIEW_TIMEOUT (108222)` | ✅ | ✅ |
| T6 | `NOTIF_ERR.AUDIENCE_NOT_FOUND (108210, P1 已存在)` | ✅ | ✅ |

### 3.2 核心接口/类型

| 类型 | 定义 | 引用 |
|---|---|---|
| `Group { operator, conditions }` | p2-3-04 compiler | p2-3-05 service / p2-3-07 RuleBuilder |
| `Condition { field, op, value }` | p2-3-04 | p2-3-05 / p2-3-07 |
| `FieldMeta { field, type, allowedOps, sqlExpr, joins }` | p2-3-03 whitelist | p2-3-04 compiler |
| `Op = 'eq'\|'ne'\|'gt'\|...` 9 种 | p2-3-03 | p2-3-04 / p2-3-07 OperatorSelect |
| `CompileResult { where, params, joins, buildFullSql }` | p2-3-04 | p2-3-05 service |
| `previewAudience` 返回 `{ sampleIds, total, timedOut }` | p2-3-05 | p2-3-06 controller / p2-3-08 AudiencePreview |

### 3.3 字段 path 一致性（白名单）

| Field | T3 sqlExpr | T4 compileExistsCondition 分支 |
|---|---|---|
| user.id / user.status / user.created_at / user.last_login_at | u.\* | n/a（普通字段） |
| member.level_id / member.expire_at | ms.\* + LEFT JOIN | n/a |
| role.code | EXISTS_ROLE_CODE | ✅ admin_user_roles + admin_roles |
| device.platform | EXISTS_DEVICE_PLATFORM | ✅ user_devices |
| favorite.tool_id | EXISTS_FAVORITE_TOOL_ID | ✅ user_tool_favorites |

**结论**：✅ 9 字段在 T3 元数据 / T4 编译器 / T6 meta API / T7 UI 四处完全一致。

---

## 4. 依赖闭环

```
T1 migration ─┬──► T2 relative-time ─┐
              │                       ↓
              │    T3 whitelist ──────► T4 compiler
              │                          │
              └──────────────────────────┴──► T5 audience-service
                                                   │
                                                   ↓
                                              T6 admin-api
                                                   │
                                                   ↓
                                              T7 RuleBuilder ──► T8 admin-pages
                                                                       │
                                                                       ↓
                                                                  T9 acceptance
```

**校验**：无环；最长链 T1 → T4 → T5 → T6 → T7 → T8 → T9 = 7 跳。

**结论**：✅ 依赖闭环成立。

---

## 5. 风险与取舍

| 风险点 | 处理方式 |
|---|---|
| SQL 注入 | sqlExpr 编译期常量 + value 全部参数化（`replacements`），field/op 严格白名单 |
| 一对多字段重复 user | EXISTS 子查询代替 JOIN（自然不去重） |
| Preview 大库慢 | Promise.race 5s 超时 + UI 显示 timedOut Alert；P3 改 SQL hint |
| 嵌套过深 | compiler maxDepth=3 + UI 端按钮在 depth=3 时隐藏 |
| 字段白名单变更需重启 | 写死代码常量；P3 改 admin 配置化 |
| EXISTS 子查询性能 | 文档要求 user_devices/user_tool_favorites 加 user_id 索引（acceptance 9.4） |

---

## 6. 验证产物预期

- **Git**：9 commits + 1 acceptance commit + 1 tag `p2-3-done`
- **后端**：1 新 lib（compiler）+ 1 lib（whitelist）+ 1 lib（relativeTime）+ audience service 改造 + 1 controller
- **DB**：迁移 021 含 1 新表 + task.audience_id 字段 + 3 权限码
- **Admin**：6 个 RuleBuilder 子组件 + 1 列表页 + 1 编辑 Drawer + AudiencePreview + Tasks Wizard 接入
- **测试**：单元 ≥ 36 用例（18 compiler + 6 relTime + 4 whitelist + 8 service）+ e2e 6 + acceptance 10

---

## 7. 自检结论

- ✅ **Spec coverage**：需求 §4.2.4 / §5.3 / §8 audience 部分 12 项全覆盖
- ✅ **Placeholder scan**：0 真实占位
- ✅ **Type consistency**：9 字段、9 操作符、`Group/Condition/FieldMeta` 接口跨 9 子文件一致
- ✅ **依赖闭环**：9 任务拓扑无环；最长链 7 跳

**P2.3 计划可进入执行阶段。**
