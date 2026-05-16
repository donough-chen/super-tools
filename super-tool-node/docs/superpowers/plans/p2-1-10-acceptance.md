# P2.1-10：端到端联调 + P2.1 验收门禁（Task 10）

> 父计划：[2026-05-23-notification-p2-1-rate-quiet-mail.md](./2026-05-23-notification-p2-1-rate-quiet-mail.md)
> 前置：Task 1-9 全部完成

---

## 10.1 后端验收

- [ ] `npm test` 全部测试通过；新增 P2.1 覆盖率 ≥ 75%
- [ ] `npm run lint` 0 错误
- [ ] DB 迁移 019 在干净库可正常 up & rollback（验证 3 次循环）
- [ ] 错误码 `108502 / 108503 / 108602` 在新代码中均被使用
- [ ] 审计日志：rate-limit / channel 所有写操作均有 `audit_logs` 行

---

## 10.2 端到端业务验收（10 场景）

> 用真实 SMTP（可用 ethereal.email 临时账号）。

| # | 场景 | 步骤 | 预期 |
|---|------|------|------|
| 1 | 频控命中拒绝 | 用户 A 短时间触发同 type 通知 11 次（默认 60s 上限 10） | 第 11 次 send_log 写 `rate_limited:user_type:*`；admin 后台消息记录少 1 条 |
| 2 | 频控窗口过期重置 | 在 10 次满后等待 60 秒再次触发 | 成功下发；redis key 已过期 |
| 3 | 静默时段 respect | 用户配置 22:00-08:00；模拟系统时钟在 03:00 触发 feedback_reply | inApp/email/sms 全部跳过；send_log 写 `quiet_hour` |
| 4 | 静默 relax 仅跳 inApp | type=marketing_xxx quietPolicy=relax；其他同上 | inApp 跳过；email/sms 仍走频控后下发 |
| 5 | 静默 bypass 强制送达 | type=unusual_login quietPolicy=bypass；用户在静默期 | 全部下发，无 send_log skipped |
| 6 | sendDirect 绕过双层 | 验证码场景 | quiet_hour 与 rate 都不触发 |
| 7 | 邮件真实发送 | admin "立即发送任务" 给一个有 email 的用户 | ethereal/SMTP 服务商收到邮件，HTML 含产品名 + 退订链接 |
| 8 | 邮件失败 BullMQ 重试 | 临时把 SMTP 密码改错 → 触发邮件 → 改回正确 | 第一次 send_log failed，BullMQ 自动重试，最终成功（attempts=3） |
| 9 | admin 改频控规则 5 分钟生效 | 把 user_global 改 maxCount=1 | 1 次后即拒绝；新建规则也立刻生效（invalidateCache） |
| 10 | admin SMTP 测试按钮 | 输入收件邮箱 + 错误密码 | 测试返回 ok=false，错误 message 显示；lastHealthOk 写 0；DB 默认 SMTP 不被破坏 |

---

## 10.3 性能 & 韧性

- [ ] 频控 Lua：1000 次连续 check 平均耗时 ≤ 5 ms
- [ ] 静默时段计算：10000 次纯函数调用 ≤ 100 ms
- [ ] 邮件 SMTP 池：连续发 50 封邮件不出现连接风暴（pool 复用）
- [ ] `app.io` reconnect：admin 端铃铛在静默/频控触发时不掉连

---

## 10.4 安全

- [ ] auth_pass 在所有 GET 接口中均为 `******`
- [ ] auth_pass 修改时若传 `******` 不覆盖原值（白盒测试）
- [ ] 错误日志不打印 SMTP 密码原文
- [ ] 渠道测试发送 API 必须有 `notification:config:edit` 权限

---

## 10.5 文档与交接

- [ ] 更新 `super-tool-node/CHANGELOG.md` 增加 P2.1 条目
- [ ] 给 PM/QA 提供"频控规则配置使用说明"（截图 RateLimit 页面流程）
- [ ] 给运维提供"SMTP 切换流程"（编辑 Channels 行 → 测试 → 设为默认）

---

## 10.6 写自检文档

- [ ] 创建 `docs/superpowers/plans/2026-05-23-notification-p2-1-self-review.md`，按 4 维度自检：

  1. **Spec coverage**：需求 §7（频控/静默/优先级矩阵）的 §7.1~§7.5 每个子节都有对应 Task
  2. **Placeholder scan**：grep `TBD/TODO/FIXME/待补充/实现略`，应 0 命中
  3. **Type consistency**：`RateRule` 接口、`QuietRule` 字段、Mail 配置 schema、错误码（108502/503/602）跨 Task 一致
  4. **依赖闭环**：Task 1-10 的依赖关系无环

---

## 10.7 Commit + tag

```bash
git add super-tool-node/CHANGELOG.md super-tool-node/docs/superpowers/plans/2026-05-23-notification-p2-1-self-review.md
git commit -m "chore(notification): mark p2.1 acceptance done

- 10 e2e scenarios verified
- self-review document attached

Refs: docs/analysis/通知推送系统模块设计需求文档.md (V2 §7)
Plan: docs/superpowers/plans/2026-05-23-notification-p2-1-rate-quiet-mail.md (Task 10)"

git tag p2-1-done
```

---

## 完成检查（整个 P2.1）

- [ ] Task 1-10 全部 commit 落库（10 commits + 1 acceptance commit + 1 tag）
- [ ] 10.1 ~ 10.4 全部勾选
- [ ] 10.5 文档已更新
- [ ] 10.6 self-review 已写
- [ ] 无 P2.1 范围内已知 P0/P1 缺陷

> P2.1 完成后进入 [P2.2 任务定时与 Cron](./2026-05-30-notification-p2-2-task-schedule.md)。
