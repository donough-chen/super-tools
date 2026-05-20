# P2.4-07：端到端联调 + P2.4 验收 + P2 完结（Task 7）

> 父计划：[2026-06-13-notification-p2-4-triggers-rollback.md](./2026-06-13-notification-p2-4-triggers-rollback.md)
> 前置：Task 1-6 全部完成

---

## 9.1 后端验收

- [ ] `npm test` 全部通过；P2.4 新增覆盖率 ≥ 75%
- [ ] `npm run lint` 0 错误
- [ ] DB 迁移 022 干净库 up & rollback 各 2 次循环成功
- [ ] 错误码 `108120 / 108121` 在新代码中均被使用
- [ ] 审计日志：template rollback 写入 `audit_logs`

---

## 9.2 端到端业务验收（10 场景）

| # | 场景 | 步骤 | 预期 |
|---|------|------|------|
| 1 | 会员升级通知 | 用户 A 通过支付升级到 v3 会员 | A 收到 inApp + email；params 含 levelName/expireAt |
| 2 | 积分变动 ≥ 50 | 完成 task_completion 积分 +100 | A 收到 inApp 通知，正确显示 action / amount / balance |
| 3 | 积分变动 < 50 不通知 | 浏览工具积分 +5 | 不通知；DB messages 无新记录 |
| 4 | 邀请好友成功 | B 注册时填 A 的邀请码 | A 收到邀请成功通知；params.inviteeName=B 的 nickname |
| 5 | 工具上线通知收藏者 | 用户 C / D 收藏了 tool#X，admin 把 X 上线 | C/D 各收到 1 条 inApp 通知；其他未收藏用户无通知 |
| 6 | 工具下架 + 替代链接 | tool#X 下架；同分类还有 tool#Y | C/D 收到下架通知，alternativeUrl 指向 Y |
| 7 | 工具下架无替代 | tool#Z（孤儿分类）下架 | alternativeUrl 指向 `/tools` 主页 |
| 8 | 模板回滚 | 模板 v3 active；admin 选 v1 → 回滚 | DB 出现 v4 active（内容=v1）；下次发出消息使用 v4 |
| 9 | 回滚到当前 active 拒绝 | 选当前 active 版本回滚 | API 返回 108121；UI 提示 "已是当前活跃版本" |
| 10 | 回滚不存在版本 | 直接 PUT API 传 targetVersion=999 | API 返回 108120 |

---

## 9.3 触发点容错

- [ ] 关闭 BullMQ Redis → 触发会员升级 → 业务返回正常；warn 日志可见 `notify failed`
- [ ] 关闭 SMTP → 触发会员升级 → inApp 通知正常下发；email 由 BullMQ 重试 3 次后写 send_log failed
- [ ] 触发 1000 个工具收藏者通知 → audience 解析 ≤ 2s；BullMQ 入队成功；逐步消费

---

## 9.4 文档与交接

- [ ] 更新 `super-tool-node/CHANGELOG.md` 增加 P2.4 + P2 全阶段总结
- [ ] 给 PM/QA 提供"业务通知矩阵"文档：5 触发点 + 模板示例 + 通知时机
- [ ] 给运营提供"模板版本管理使用手册"：新建草稿 → 预览 → 发布 → 回滚

---

## 9.5 写自检文档 `2026-06-13-notification-p2-4-self-review.md`

按 4 维度自检：

1. **Spec coverage**：5 触发点 + 模板回滚 API + UI 全覆盖
2. **Placeholder scan**：grep `TBD/TODO/FIXME/待补充/实现略`，0 命中
3. **Type consistency**：5 个 typeKey 在 SQL seed / 触发代码 / 测试三处一致；rollback 错误码 NOTIFY_TEMPLATE_VERSION_* 一致
4. **依赖闭环**：Task 1-7 依赖图无环

---

## 9.6 Commit + tag P2.4 + tag P2

```bash
git add super-tool-node/CHANGELOG.md super-tool-node/docs/superpowers/plans/2026-06-13-notification-p2-4-self-review.md
git commit -m "chore(notification): mark p2.4 acceptance done

- 10 e2e scenarios verified (5 triggers + template rollback)
- self-review document attached

Refs: docs/analysis/通知推送系统模块设计需求文档.md (V2 §11 §10.2)
Plan: docs/superpowers/plans/2026-06-13-notification-p2-4-triggers-rollback.md (Task 7)"

git tag p2-4-done

# === P2 阶段全部完成，打总 tag ===
git tag p2-done
```

---

## 9.7 P2 阶段全景回顾（写入 self-review 末尾或单独 README）

| 子计划 | 范围 | tag |
|--------|------|-----|
| P2.1 | 频控 + 静默 + 邮件真实发送 | `p2-1-done` |
| P2.2 | 任务调度（4 sendType + 4 生命周期 + boot 恢复） | `p2-2-done` |
| P2.3 | 动态受众规则（compiler + RuleBuilder UI） | `p2-3-done` |
| P2.4 | 5 业务触发点 + 模板版本回滚 UI | `p2-4-done` |
| **合计** | 4 子计划，1 总 overview | `p2-done` |

**P2 累计交付物**：

- 后端：4 个迁移（019-022）+ 8 个新 service + 4 个新队列/worker/boot + 多个 controller/lib/adapter
- Admin：4 个新模块页面（Configs/Audiences + 任务调度增强 + 模板版本）
- 测试：累计 ≥ 100 单测 + ≥ 40 e2e + ≥ 40 用例集成
- 错误码：新增约 25 个（108110~108222 段）
- 触发点：5 个业务流自动通知

> P2 完成后 → 评估是否进入 P3（看板 / dashboard widget / 国际化 / 多 SMTP 切换 / 短信真实接入）。

---

## 完成检查（整个 P2.4）

- [ ] Task 1-7 全部 commit 落库（7 commits + 1 acceptance commit + 2 tags）
- [ ] 9.1 ~ 9.3 全部勾选
- [ ] 9.4 文档已更新
- [ ] 9.5 self-review 已写
- [ ] 9.6 双 tag（p2-4-done + p2-done）已打
- [ ] 无 P2.4 范围内已知 P0/P1 缺陷
