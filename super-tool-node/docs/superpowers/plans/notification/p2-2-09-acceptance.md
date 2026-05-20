# P2.2-09：端到端联调 + P2.2 验收门禁（Task 9）

> 父计划：[2026-05-30-notification-p2-2-task-schedule.md](./2026-05-30-notification-p2-2-task-schedule.md)
> 前置：Task 1-8 全部完成

---

## 9.1 后端验收

- [ ] `npm test` 全部通过；P2.2 新增覆盖率 ≥ 75%
- [ ] `npm run lint` 0 错误
- [ ] DB 迁移 020 干净库 up & rollback 各 2 次循环成功
- [ ] 新增 6 个错误码 `108310-108315` 在代码中均被使用
- [ ] 审计日志：task 的 create / pause / resume / cancel / undo 全部写入 `audit_logs`

---

## 9.2 端到端业务验收（10 场景）

| # | 场景 | 步骤 | 预期 |
|---|------|------|------|
| 1 | 立即发送 + 撤销 | 创建 immediate → 5 秒内点撤销 | task.status=canceled；BullMQ delayed job 被删；下游用户无消息 |
| 2 | 立即发送 + 超窗口 | 创建后 35 秒点撤销 | 提示 108314 UNDO_EXPIRED；任务正常完成 |
| 3 | 定时一次准时触发 | 创建 scheduled，scheduledAt = now + 60s | 60s 后 worker 触发，task=completed，消息送达 |
| 4 | 定时一次取消 | 创建 scheduled (now+10min) → 立即取消 | task=canceled；timer 不触发 |
| 5 | Cron 周期触发 | 创建 cron `*/2 * * * *`（每 2 分钟，调试用） | 2 分钟内首次触发；nextFireAt 推进；status 保持 scheduled |
| 6 | Cron 暂停/恢复 | 周期任务运行后暂停 → 等 5 分钟 → 恢复 | 暂停期间不触发；恢复后下个周期点触发 |
| 7 | RRule 链式触发 | 创建 rrule `FREQ=MINUTELY;INTERVAL=2`（仅测试） | 每 2 分钟一次；上次触发后 worker 自动入下一个 delayed job |
| 8 | 应用重启恢复 cron | 创建 cron 任务 → kill -9 进程 → 重启 | boot 日志可见 `restored cron task <id>`；下次触发时间不丢 |
| 9 | 应用重启恢复 rrule | 创建 rrule 任务 → 重启 | boot 日志可见 `restored rrule task ... next=...`；过期 nextFireAt 自动重算 |
| 10 | Stuck 任务自动恢复 | 手动 SQL `UPDATE notification_tasks SET status='running', started_at=now()-INTERVAL 1 HOUR WHERE id=X` | 5 分钟内（或重启时）任务被标 failed，failReason 含 'stuck' |

---

## 9.3 性能 & 韧性

- [ ] 同时存在 100 个 cron 任务时 boot 重启 ≤ 5s
- [ ] cron 任务密集触发（10 任务每分钟同时触发）worker 不积压（BullMQ active < 100）
- [ ] BullMQ Redis 重启后 worker 自动重连
- [ ] 1000 用户的 sendByAudience 在 1 个 task job 内完成 ≤ 30s

---

## 9.4 安全 & 权限

- [ ] `notification:task:pause` 没有时 pause 接口 403
- [ ] `notification:task:cancel` 没有时 cancel 接口 403
- [ ] `notification:task:undo` 没有时 undo 接口 403
- [ ] cron 表达式前后端均做校验（SQL 注入 / 命令注入不可行）
- [ ] rrule BYYEAR=9999 之类长跨度被 `rruleHasFireWithin` 拒绝

---

## 9.5 文档与交接

- [ ] 更新 `super-tool-node/CHANGELOG.md` 增加 P2.2 条目
- [ ] 给 PM/QA 提供"任务调度使用手册"
  - 4 种发送方式截图
  - cron/rrule 常用模板示例
  - 暂停/恢复/取消/撤销操作流程
- [ ] 给 SRE 提供"重启恢复行为说明"（cron 自动恢复，stuck 自动 failed）

---

## 9.6 写自检文档 `2026-05-30-notification-p2-2-self-review.md`

按 4 维度自检：

1. **Spec coverage**：需求 §6.6 任务调度的 4 sendType + 4 生命周期 + boot 恢复 + stuck 全覆盖；P1 验收 #4-7 全覆盖
2. **Placeholder scan**：grep `TBD/TODO/FIXME/待补充/实现略`，0 命中
3. **Type consistency**：
   - `SendType` 联合类型在 service / controller / UI 一致
   - `TaskStatus` 枚举（pending/scheduled/running/paused/completed/failed/canceled）跨层一致
   - 错误码常量名（NOTIFY_TASK_*）与本计划声明一致
4. **依赖闭环**：Task 1-9 依赖图无环

---

## 9.7 Commit + tag

```bash
git add super-tool-node/CHANGELOG.md super-tool-node/docs/superpowers/plans/2026-05-30-notification-p2-2-self-review.md
git commit -m "chore(notification): mark p2.2 acceptance done

- 10 e2e scenarios verified (immediate+undo / scheduled / cron / rrule / restart restore / stuck recover)
- self-review document attached

Refs: docs/analysis/通知推送系统模块设计需求文档.md (V2 §6.6)
Plan: docs/superpowers/plans/2026-05-30-notification-p2-2-task-schedule.md (Task 9)"

git tag p2-2-done
```

---

## 完成检查（整个 P2.2）

- [ ] Task 1-9 全部 commit 落库（9 commits + 1 acceptance commit + 1 tag）
- [ ] 9.1 ~ 9.4 全部勾选
- [ ] 9.5 文档已更新
- [ ] 9.6 self-review 已写
- [ ] 无 P2.2 范围内已知 P0/P1 缺陷

> P2.2 完成后进入 [P2.3 动态受众规则](./2026-06-06-notification-p2-3-dynamic-audience.md)。
