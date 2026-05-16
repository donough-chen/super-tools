# P2.4 实施计划：新触发点 + 模板版本回滚 UI（总览）

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement each Task by sub-file.

**Goal:** 完成 P2 收尾，把 4 个业务触发点（邀请好友成功 / 工具上线 / 工具下架 / 会员升级 / 积分变动）接入 P1 已搭建的 `notification.send` 主链路；同时在 admin 端补齐模板版本回滚 UI（DB 已就绪，仅缺前端）。

**Architecture:**
- **触发点接入**：在 5 处业务 service 内插入 `ctx.service.notification.send(...)` 调用；幂等键统一 `bizRefType + bizRefId`；不修改原业务事务边界（通知失败不回滚业务）
- **工具上下架**：受众 = 工具收藏者（`favorite.tool_id` 字段，已在 P2.3 白名单内）；用 `sendByAudience` + `audienceType=dynamic`
- **模板版本回滚**：admin 端"模板详情" Drawer 新增"版本树"标签页，列出全部历史版本；可点"回滚到此版本"按钮（复用 P1 已建的 `publishVersion` service，只需 controller 增加 `rollback` 端点）
- **失败容错**：所有触发点 `try/catch` 包裹，失败仅打 warn 日志，不抛回业务

**Tech Stack:**
- 后端：Egg.js 3 + 复用 P1 service / P2.3 audience compiler
- Admin：UmiJS 4 + AntD 5 在已有 Templates 页面增加 VersionList Drawer

**Reference:** [通知推送系统模块设计需求文档（V2）](../../analysis/通知推送系统模块设计需求文档.md) §11.2.5/11.2.6/11.2.7（触发点）+ §10.2（模板版本 API）

**前置条件**：
- P1 已合入，tag `p1-notification-done`
- P2.1 / P2.2 / P2.3 已合入
- P1 已建 `notification_template_versions` 表（验证：`DESC notification_template_versions;` 应可见）

---

## 范围（明确做与不做）

### ✅ 做

| 模块 | 内容 |
|------|------|
| DB 迁移 022 | 仅插入 5 条业务类型（type）+ 对应模板（zh-CN/inApp，部分 +email）；不改表结构 |
| 后端触发点 5 处 | `member.ts`（升级+积分）、`invite.ts`（邀请成功）、`tool.ts`（上下架，2 个调用） |
| 后端模板回滚 API | 新增 `POST /api/admin/notification/templates/:id/rollback/:versionId` |
| Admin UI - 模板版本 | `TemplateVersionDrawer`：版本列表 + 内容对比 + 回滚按钮 |
| 单测覆盖 | 5 个触发点 single-call 测试（mock notification.send）+ rollback service & controller 4 用例 + UI 视目验 |

### ❌ 不做（留 P3）

- 国际化模板（仅 zh-CN；en-US 留 P3）
- 模板可视化富文本编辑器（保持 textarea + {{var}}）
- 触发点 schedule（如"会员到期前 7 天提醒"是定时型，留 P3）
- 触发点的 admin 配置开关（用户偏好已能关闭；admin 全局开关留 P3）

---

## 文件结构总览

### 后端

```
super-tool-node/
├── database/
│   ├── 022_p2_business_triggers.sql            # 新建：5 type + 模板 seed
│   └── 022_rollback.sql                        # 新建
├── app/
│   ├── constants/errorCodes.ts                 # 修改：+108120 ROLLBACK 错误码
│   ├── service/
│   │   ├── notification-template.ts            # 修改：+rollbackToVersion 方法
│   │   ├── member.ts                           # 修改：升级+积分变动调用通知
│   │   ├── invite.ts                           # 修改：注册成功调用通知
│   │   └── tool.ts                             # 修改：上线/下架调用通知
│   ├── controller/admin/
│   │   └── notification-template.ts            # 修改：+rollback 端点 + listVersions
│   └── router.ts                               # 修改：注册新路由
└── test/notification/
    ├── trigger/
    │   ├── member-upgrade.test.ts              # 新建
    │   ├── points-change.test.ts               # 新建
    │   ├── invite-success.test.ts              # 新建
    │   ├── tool-published.test.ts              # 新建
    │   └── tool-unpublished.test.ts            # 新建
    └── service/
        └── notification-template-rollback.test.ts  # 4 用例
```

### 管理端

```
super-tools-admin/
└── src/pages/Notification/Templates/
    ├── index.tsx                               # 修改：行操作"版本"按钮
    ├── TemplateVersionDrawer.tsx               # 新建：版本列表 + 对比 + 回滚
    └── VersionDiffView.tsx                     # 新建：左右对比 title/body diff
```

---

## 任务列表（7 Task，分 7 个子文件）

| # | Task | 子文件 | 工程量 | 依赖 |
|---|------|--------|-------|------|
| 1 | DB 迁移 022 + 错误码 | [`p2-4-01-migration-types-templates.md`](./p2-4-01-migration-types-templates.md) | M | - |
| 2 | 模板回滚 service + 测试（4 用例） | [`p2-4-02-template-rollback.md`](./p2-4-02-template-rollback.md) | M | 1 |
| 3 | 触发点：member.upgrade + member.pointsChange + 测试 | [`p2-4-03-trigger-member.md`](./p2-4-03-trigger-member.md) | M | 1 |
| 4 | 触发点：invite.success + 测试 | [`p2-4-04-trigger-invite.md`](./p2-4-04-trigger-invite.md) | S | 1 |
| 5 | 触发点：tool.published + tool.unpublished + 测试 | [`p2-4-05-trigger-tool.md`](./p2-4-05-trigger-tool.md) | M | 1, P2.3 |
| 6 | Admin UI - TemplateVersionDrawer + VersionDiffView | [`p2-4-06-admin-version-ui.md`](./p2-4-06-admin-version-ui.md) | M | 2 |
| 7 | 端到端联调 + P2.4 验收 + tag p2-4-done + P2 完结 tag | [`p2-4-07-acceptance.md`](./p2-4-07-acceptance.md) | M | 1-6 |

> 共 7 子文件。Task 3-5 都是触发点接入，模式相同，可并行实施。

### 子文件依赖关系

```
01-migration ─┬─► 02-rollback ─► 06-admin-ui
              │
              ├─► 03-trigger-member ─┐
              │                      │
              ├─► 04-trigger-invite ─┼─► 07-acceptance
              │                      │
              └─► 05-trigger-tool ───┘
```

---

## P2.4 共享前提

### 5 个业务类型 typeKey

| typeKey | 名称 | 优先级 | 默认渠道 | 触发文件 |
|---------|------|--------|---------|---------|
| `member_upgrade`     | 会员升级成功 | high   | inApp + email | `app/service/member.ts` |
| `points_change`      | 积分变动     | normal | inApp         | `app/service/member.ts` |
| `invite_success`     | 邀请好友成功 | normal | inApp         | `app/service/invite.ts` |
| `tool_published`     | 工具上线     | normal | inApp         | `app/service/tool.ts` |
| `tool_unpublished`   | 工具下架     | normal | inApp         | `app/service/tool.ts` |

> **注意**：需求文档中常量名 `BUSINESS_MEMBER_UPGRADE` 等是模板代码；本计划 typeKey 用更短的 snake_case 形式（与 P1/P2 已建 type 风格一致）。Task 1 SQL 中两种命名都写注释。

### 错误码（新增 1 个）

| 码值 | 常量 | 含义 |
|------|------|------|
| 108120 | NOTIFY_TEMPLATE_VERSION_NOT_FOUND | 模板版本不存在 |
| 108121 | NOTIFY_TEMPLATE_ROLLBACK_SAME_VERSION | 回滚目标与当前 active 版本相同 |

### Commit 规范

```
feat(notification): <task summary>

Refs: docs/analysis/通知推送系统模块设计需求文档.md (V2 §11.2.x §10.2)
Plan: docs/superpowers/plans/2026-06-13-notification-p2-4-triggers-rollback.md (Task N)
```

---

## Self-Review 备忘

P2.4 完成后写 [`2026-06-13-notification-p2-4-self-review.md`](./2026-06-13-notification-p2-4-self-review.md)，4 维自检：

1. **Spec coverage**：5 个触发点 + 模板版本回滚 API + UI 全覆盖
2. **Placeholder scan**：`TBD/FIXME/待补充/实现略/后续补充` 0 命中
3. **Type consistency**：5 个 typeKey 在 SQL seed / 触发代码 / 测试用例三处一致
4. **依赖闭环**：上方依赖图无环

完成 P2.4 后，**整个 P2 阶段完结**，建议打 tag `p2-done`。
