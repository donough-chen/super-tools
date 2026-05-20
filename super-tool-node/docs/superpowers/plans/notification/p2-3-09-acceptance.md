# P2.3-09：端到端联调 + P2.3 验收门禁（Task 9）

> 父计划：[2026-06-06-notification-p2-3-dynamic-audience.md](./2026-06-06-notification-p2-3-dynamic-audience.md)
> 前置：Task 1-8 全部完成

---

## 9.1 后端验收

- [ ] `npm test` 全部通过；P2.3 新增覆盖率 ≥ 75%
- [ ] `npm run lint` 0 错误
- [ ] DB 迁移 021 干净库 up & rollback 各 2 次循环成功
- [ ] 错误码 `108211 / 108212 / 108220 / 108221 / 108222` 在新代码中均被使用
- [ ] 审计日志：audience CRUD 全部写入 `audit_logs`

---

## 9.2 端到端业务验收（10 场景）

> 准备测试数据：库内至少 1000 个 user，部分有 member_subscriptions / user_devices / user_tool_favorites。

| # | 场景 | 步骤 | 预期 |
|---|------|------|------|
| 1 | 简单单条件 | 规则：`user.status = 1` | preview 返回所有活跃用户；任务可创建并下发 |
| 2 | AND 多条件 | `user.status=1 AND member.level_id IN [3,4,5]` | 返回 VIP 活跃用户；样本展示 user.id 列表 |
| 3 | OR 嵌套 AND | `(member.level_id=5) OR (user.created_at < P30D AND user.last_login_at >= P7D)` | 嵌套 2 层；preview 数字合理 |
| 4 | EXISTS 字段 | `role.code IN ['vip']` | 编译为 EXISTS 子查询；返回 vip 角色用户 |
| 5 | 多 EXISTS 字段 | `device.platform IN ['ios'] AND favorite.tool_id = 12345` | 两个 EXISTS 都生成；用户列表正确 |
| 6 | 相对时间 | `user.last_login_at >= P30D` | now-30d 转 ISO 字符串；用户列表为最近 30 天活跃 |
| 7 | 字段白名单拒绝 | 改 JSON：`field=user.password` | 创建/预览返回 108211 |
| 8 | 操作符拒绝 | `user.status > 1`（status 不允许 gt） | 返回 108212 |
| 9 | 嵌套 4 层 | 手工构造 4 层 group | 返回 108220 |
| 10 | 大库预览超时 | 在 1000 万行表上跑复杂规则 | preview.timedOut=true；admin 显示警告 Alert |

---

## 9.3 任务集成验收

- [ ] 创建动态受众任务（sendType=immediate）：30s 内可撤销，30s 后用户实际收到通知
- [ ] 创建任务时引用已保存 audience_id：保存后任务 `audienceType=dynamic` + 内部 audience_id 关联
- [ ] 修改受众分组规则后，**新任务**使用新规则；**已发出消息**不变（受众解析在 send 时执行）
- [ ] 任务详情显示"实际触达 N 用户" = preview 时 total（容差 ±5%，因解析时间差）

---

## 9.4 性能 & 韧性

- [ ] 1000 用户库的简单规则 preview ≤ 500ms
- [ ] 1 万用户库的 EXISTS 子查询规则 preview ≤ 2s
- [ ] 复杂规则（5 个条件 + 2 个 EXISTS）解析为 SQL 在 EXPLAIN 中走索引（必要时给 user_devices/user_tool_favorites 加 user_id 索引）
- [ ] 任务受众解析失败时（如 DB 超时）不影响其他任务

---

## 9.5 安全

- [ ] **SQL 注入测试**：尝试 `value: "'; DROP TABLE users; --"` 字符串字段 → 参数化保护，DB 正常
- [ ] **字段穷举**：尝试所有 `users` 表字段 → 仅白名单内字段可用
- [ ] **EXISTS 子查询**：role/device/favorite 不会让用户重复出现（GROUP BY u.id 不需要，因为是 EXISTS）
- [ ] **权限**：`notification:audience:preview` 没有时不能预览
- [ ] **跨用户访问**：受众分组列表当前不区分创建人；如有要求可加 `created_by = ctx.adminUser.id` 过滤（P2.3 不实现）

---

## 9.6 文档与交接

- [ ] 更新 `super-tool-node/CHANGELOG.md` 增加 P2.3 条目
- [ ] 给 PM/QA 提供"动态受众规则使用手册"
  - 9 字段含义说明
  - 常用规则示例（VIP / 沉睡用户 / 新注册 / 收藏特定工具）
  - 嵌套 AND/OR 用法
- [ ] 给 SRE 提供"性能优化检查清单"（必要的索引）

---

## 9.7 写自检文档 `2026-06-06-notification-p2-3-self-review.md`

按 4 维度自检：

1. **Spec coverage**：需求 §4.2.4 字段白名单 8 字段 + 9 操作符 + P30D 相对时间 + 嵌套 3 层全覆盖；§5.3 audience service dynamic 分支已实装
2. **Placeholder scan**：grep `TBD/TODO/FIXME/待补充/实现略`，0 命中
3. **Type consistency**：
   - `Group / Condition` 接口 compiler ↔ service ↔ RuleBuilder 一致
   - 错误码常量 NOTIFY_AUDIENCE_* 跨子文件一致
4. **依赖闭环**：Task 1-9 依赖图无环

---

## 9.8 Commit + tag

```bash
git add super-tool-node/CHANGELOG.md super-tool-node/docs/superpowers/plans/2026-06-06-notification-p2-3-self-review.md
git commit -m "chore(notification): mark p2.3 acceptance done

- 10 e2e scenarios verified (simple/AND/OR/EXISTS/relative-time/whitelist/nested/timeout)
- Task integration verified (immediate+undo + audience_id reference)
- self-review document attached

Refs: docs/analysis/通知推送系统模块设计需求文档.md (V2 §4.2.4 §5.3)
Plan: docs/superpowers/plans/2026-06-06-notification-p2-3-dynamic-audience.md (Task 9)"

git tag p2-3-done
```

---

## 完成检查（整个 P2.3）

- [ ] Task 1-9 全部 commit 落库（9 commits + 1 acceptance commit + 1 tag）
- [ ] 9.1 ~ 9.5 全部勾选
- [ ] 9.6 文档已更新
- [ ] 9.7 self-review 已写
- [ ] 无 P2.3 范围内已知 P0/P1 缺陷

> P2.3 完成后进入 [P2.4 新触发点 + 模板回滚 UI](./2026-06-13-notification-p2-4-triggers-rollback.md)（最后一份 P2 子计划）。
