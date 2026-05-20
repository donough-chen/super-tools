# P2.3 实施计划：动态受众规则（解析引擎 + admin 可视化编辑器）（总览）

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement each Task by sub-file.

**Goal:** 在 P1 仅支持 `all` / `static` 受众的基础上，实现完整的 **动态受众（dynamic）** 能力：JSON 规则编译为 SQL → 计算用户列表 + 受众预览（前 100 + 总数）+ admin 端可视化 RuleBuilder（嵌套 AND/OR + 字段白名单 + 操作符 9 种 + 相对时间 P30D）。

**Architecture:**
- 规则模型：`{ operator: 'and'|'or', conditions: [Cond | Group] }`，最大嵌套 3 层
- 字段白名单：5 张表 8 字段（user/member/role/device/favorite）
- 操作符 9 种：`eq/ne/gt/gte/lt/lte/in/nin/between`
- 相对时间：`P{N}D` 转换为 `now() - INTERVAL N DAY`
- 编译器：`audienceRuleCompiler`：JSON → 安全的 SQL 片段（字段白名单 + 参数化值，不拼字符串）
- 解析服务：`notification-audience.ts`（替换 P1 的 `dynamic` 不支持分支）
- admin UI：`RuleBuilder` 组件 + `AudiencePreview` 组件（试算前 100 用户 + 总数）

**Tech Stack:**
- 后端：Egg.js 3 + Sequelize 原生 SQL（`sequelize.query`）
- Admin：UmiJS 4 + AntD 5 自实现树形 RuleBuilder（不依赖 react-querybuilder，避免大依赖）

**Reference:** [通知推送系统模块设计需求文档（V2）](../../analysis/通知推送系统模块设计需求文档.md) §4.2.4（dynamic_rules）+ §5.3（audience service）

**前置条件**：
- P1 已合入 master，tag `p1-notification-done`
- P2.1 / P2.2 已合入（非强制依赖，但建议）
- 阅读需求文档第 4.2.4 节（dynamic_rules JSON 结构）+ 5.3 节（audience service）

---

## 范围（明确做与不做）

### ✅ 做

| 模块 | 内容 |
|------|------|
| DB 迁移 021 | 新增 `notification_audiences` 表（保存可复用受众分组）+ admin 权限码 `notification:audience:view/edit` |
| 后端 lib | `audienceRuleCompiler`：JSON 规则 → `{ sql, params, joins }`；含字段白名单 + 操作符校验 |
| 后端 service | `notification-audience.ts` 替换 P1 dynamic 抛错为真实解析；新增 `previewAudience(rules)` 返回前 100 用户 + count |
| 后端 admin API | `/api/admin/notification/audiences` CRUD + `/preview` 端点（不依赖保存就能试算） |
| Admin UI | `Notification/Audiences` 列表页 + `AudienceFormDrawer`（含 RuleBuilder + AudiencePreview） |
| Tasks Wizard | Step 2 增加"动态受众"选项，弹出 RuleBuilder；保存任务时 `audienceRule` 写完整 JSON |
| 单测覆盖 | compiler 18 用例（9 操作符 × 2 + 相对时间 + 嵌套 + 白名单拒绝）+ audience service 8 用例 + admin API 6 用例 |

### ❌ 不做（留 P3）

- 字段白名单运行时配置化（本计划写死在代码常量；P3 admin 可配）
- 嵌套深度 > 3 层
- 跨多 DB 受众解析
- 受众结果实时刷新（每次任务执行重算；不缓存）
- 受众导出 CSV
- A/B test 受众分流

---

## 文件结构总览

### 后端

```
super-tool-node/
├── database/
│   ├── 021_p2_dynamic_audience.sql              # 新建
│   └── 021_rollback.sql                         # 新建
├── app/
│   ├── constants/errorCodes.ts                  # 修改：实装 108201/108211/108212/108220
│   ├── lib/
│   │   ├── audienceFieldWhitelist.ts            # 新建：8 字段白名单 + 表 join 元数据
│   │   ├── audienceRuleCompiler.ts              # 新建：JSON → SQL 片段
│   │   └── relativeTimeParser.ts                # 新建：P{N}D / P{N}H / P{N}M
│   ├── service/
│   │   └── notification-audience.ts             # 修改：dynamic 真实解析 + preview
│   ├── controller/admin/
│   │   └── notification-audience.ts             # 新建
│   ├── model/
│   │   └── notification_audience.ts             # 修改/新建：完整字段
│   └── router.ts                                # 修改：注册新路由
└── test/notification/
    ├── lib/
    │   ├── audience-rule-compiler.test.ts       # 18 用例
    │   └── relative-time-parser.test.ts         # 6 用例
    ├── service/
    │   └── notification-audience-dynamic.test.ts# 8 用例
    └── controller/admin/
        └── notification-audience.test.ts        # 6 用例
```

### 管理端

```
super-tools-admin/
├── config/routes/modules/notification.ts        # 修改：+/notification/audiences
└── src/pages/Notification/
    ├── Audiences/
    │   ├── index.tsx                            # 新建：列表页
    │   └── AudienceFormDrawer.tsx               # 新建：编辑 + RuleBuilder + Preview
    ├── _shared/
    │   ├── RuleBuilder/
    │   │   ├── index.tsx                        # 新建：根组件（嵌套递归）
    │   │   ├── ConditionRow.tsx                 # 新建：单条件 field/op/value
    │   │   ├── GroupBlock.tsx                   # 新建：AND/OR 分组
    │   │   ├── FieldSelect.tsx                  # 新建：字段下拉（按白名单）
    │   │   ├── OperatorSelect.tsx               # 新建：op 下拉（按字段类型过滤）
    │   │   ├── ValueInput.tsx                   # 新建：根据 op 渲染不同输入
    │   │   └── relativeTimeHelper.ts            # 新建：UI 端 P30D 助手
    │   └── AudiencePreview.tsx                  # 新建：调 /preview API 显示前 100 + 总数
    └── Tasks/CreateTaskWizard.tsx               # 修改：Step 2 audience 选项 +"动态规则"
```

---

## 任务列表（10 Task，分 9 个子文件）

| # | Task | 子文件 | 工程量 | 依赖 |
|---|------|--------|-------|------|
| 1 | DB 迁移 021 + 错误码 + Model | [`p2-3-01-migration-errcodes.md`](./p2-3-01-migration-errcodes.md) | M | - |
| 2 | relativeTimeParser + 测试（6 用例） | [`p2-3-02-relative-time.md`](./p2-3-02-relative-time.md) | S | 1 |
| 3 | audienceFieldWhitelist 元数据表 | [`p2-3-03-whitelist.md`](./p2-3-03-whitelist.md) | S | - |
| 4 | audienceRuleCompiler + 测试（18 用例） | [`p2-3-04-compiler.md`](./p2-3-04-compiler.md) | L | 2, 3 |
| 5 | notification-audience service 改造 + 测试（8 用例） | [`p2-3-05-audience-service.md`](./p2-3-05-audience-service.md) | M | 4 |
| 6 | admin API（audiences CRUD + preview）+ 测试（6 用例） | [`p2-3-06-admin-api.md`](./p2-3-06-admin-api.md) | M | 5 |
| 7 | Admin UI - RuleBuilder 组件套件 | [`p2-3-07-admin-rule-builder.md`](./p2-3-07-admin-rule-builder.md) | L | 6 |
| 8 | Admin UI - Audiences 页面 + AudiencePreview + Tasks Wizard 接入 | [`p2-3-08-admin-pages.md`](./p2-3-08-admin-pages.md) | M | 7 |
| 9 | 端到端联调 + P2.3 验收 + tag p2-3-done | [`p2-3-09-acceptance.md`](./p2-3-09-acceptance.md) | M | 1-8 |

> 共 9 子文件。Task 4（compiler）是核心；Task 7（RuleBuilder）是 UI 重头戏；其他较轻量。

### 子文件依赖关系

```
01-migration ─┬──► 02-relative-time ─┐
              │                      ↓
              │    03-whitelist ─────► 04-compiler
              │                          │
              └──────────────────────────┴──► 05-audience-service
                                                   │
                                                   ↓
                                              06-admin-api
                                                   │
                                                   ↓
                                          07-rule-builder ──► 08-admin-pages
                                                                   │
                                                                   ↓
                                                            09-acceptance
```

---

## P2.3 共享前提

### 错误码（已在 P1 占位 / 本计划新增）

| 码值 | 常量 | 含义 |
|------|------|------|
| 108201 | NOTIFY_AUDIENCE_DYNAMIC_NOT_IMPL | P1 占位；P2.3 移除（解析已实现，不再使用） |
| 108211 | NOTIFY_AUDIENCE_FIELD_INVALID | 字段不在白名单 |
| 108212 | NOTIFY_AUDIENCE_OP_INVALID | 操作符非法 |
| 108220 | NOTIFY_AUDIENCE_NESTED_TOO_DEEP | 嵌套层数 > 3 |
| 108221 | NOTIFY_AUDIENCE_VALUE_INVALID | value 类型与字段不匹配 |
| 108222 | NOTIFY_AUDIENCE_PREVIEW_TIMEOUT | 受众预览查询超时（>5s） |

> Task 1 内一并实装 + `NOTIF_ERR` 短别名映射。

### 字段白名单（写死代码）

| field 路径 | DB 表 | 类型 | 允许操作符 | join 子句 |
|-----------|-------|------|-----------|-----------|
| `user.id` | `users` | int | eq/ne/in/nin | 主表 |
| `user.status` | `users` | int | eq/ne | 主表 |
| `user.created_at` | `users` | datetime | gte/lte/gt/lt | 主表 |
| `user.last_login_at` | `users` | datetime | gte/lte/gt/lt | 主表 |
| `member.level_id` | `member_subscriptions` | int | eq/ne/in/nin | LEFT JOIN |
| `member.expire_at` | `member_subscriptions` | datetime | gte/lte/gt/lt | LEFT JOIN |
| `role.code` | `admin_user_roles` + `admin_roles` | string | in/nin | EXISTS 子查询 |
| `device.platform` | `user_devices` | string | in/nin | EXISTS 子查询 |
| `favorite.tool_id` | `user_tool_favorites` | int | eq/in | EXISTS 子查询 |

> 详细元数据见 Task 3 实现。

### Commit 规范

```
feat(notification): <task summary>

Refs: docs/analysis/通知推送系统模块设计需求文档.md (V2 §4.2.4 §5.3)
Plan: docs/superpowers/plans/2026-06-06-notification-p2-3-dynamic-audience.md (Task N)
```

---

## Self-Review 备忘

P2.3 完成后写 [`2026-06-06-notification-p2-3-self-review.md`](./2026-06-06-notification-p2-3-self-review.md)，4 维自检：

1. **Spec coverage**：需求 §4.2.4 字段白名单 + 9 操作符 + 相对时间 + 嵌套 3 层全覆盖
2. **Placeholder scan**：grep `TBD/TODO/FIXME/待补充/实现略`，0 命中
3. **Type consistency**：`Rule` / `Condition` / `Group` 接口在 compiler / service / RuleBuilder 一致
4. **依赖闭环**：上方依赖图无环
