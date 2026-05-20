# P2.2-01：依赖 + config + 错误码（Task 1）

> 父计划：[2026-05-30-notification-p2-2-task-schedule.md](./2026-05-30-notification-p2-2-task-schedule.md)

---

## Step 1: 添加依赖

```bash
cd super-tool-node
npm i rrule@^2.7.2 cron-parser@^4.9.0
```

预期：`package.json` 出现 `rrule ^2.7.2`、`cron-parser ^4.9.0`。

---

## Step 2: 修改 `config/config.default.ts`

在 `config.notification` 节点追加：

```typescript
config.notification = {
  ...config.notification, // P1 + P2.1 保留

  task: {
    /** 启用任务调度（生产环境 true；unittest 由 config.unittest.ts 关掉避免悬挂） */
    enabled: true,

    /** 一次性定时任务的最小提前量（秒）；admin 创建时 scheduledAt 必须 ≥ now + 此值 */
    minScheduleSec: 30,

    /** immediate 任务的"撤销窗口"（秒）；用户在此窗口内可一键撤销 */
    undoWindowSec: 30,

    /** Stuck 任务判定阈值：running 但 startedAt 早于 now-N 秒 → 标 failed */
    stuckThresholdSec: 30 * 60,

    /** 启动时 stuck 扫描间隔（毫秒）；0 表示仅启动时扫描一次 */
    stuckScanIntervalMs: 5 * 60 * 1000,

    /** rrule 任务的最大未来跨度（天）；防止 RRULE BYYEAR=2099 导致 BullMQ 堆积 */
    rruleMaxFutureDays: 365,

    queueName: 'notif.task',

    /** task 队列与 send 队列共用 redis；继承 notification.queue.connection */
    concurrency: 4,
  },
};
```

---

## Step 3: 修改 `app/constants/errorCodes.ts`

在 P1+P2.1 已有错误码后追加：

```typescript
// 任务调度扩展 108310-108315
NOTIFY_TASK_RRULE_INVALID:    { code: 108310, message: 'RRULE 表达式非法' },
NOTIFY_TASK_CANNOT_PAUSE:     { code: 108311, message: '任务状态不允许暂停' },
NOTIFY_TASK_CANNOT_RESUME:    { code: 108312, message: '任务状态不允许恢复' },
NOTIFY_TASK_CANNOT_CANCEL:    { code: 108313, message: '任务状态不允许取消' },
NOTIFY_TASK_UNDO_EXPIRED:     { code: 108314, message: '撤销窗口已过期' },
NOTIFY_TASK_NOT_PAUSED:       { code: 108315, message: '任务非暂停状态' },
```

并在 `NOTIF_ERR` 短别名段补齐：

```typescript
TASK_RRULE_INVALID:   ErrorCodes.NOTIFY_TASK_RRULE_INVALID,
TASK_CANNOT_PAUSE:    ErrorCodes.NOTIFY_TASK_CANNOT_PAUSE,
TASK_CANNOT_RESUME:   ErrorCodes.NOTIFY_TASK_CANNOT_RESUME,
TASK_CANNOT_CANCEL:   ErrorCodes.NOTIFY_TASK_CANNOT_CANCEL,
TASK_UNDO_EXPIRED:    ErrorCodes.NOTIFY_TASK_UNDO_EXPIRED,
TASK_NOT_PAUSED:      ErrorCodes.NOTIFY_TASK_NOT_PAUSED,
```

> P1 已有 `108301 TASK_NOT_FOUND / 108302 TASK_STATUS_INVALID / 108303 TASK_SCHEDULE_TOO_SOON / 108304 TASK_CRON_INVALID`，本次不动。

---

## Step 4: 验证

- [ ] `npm run lint` 0 错误
- [ ] `node -e "console.log(require('rrule').RRule.toString)"` 不报错
- [ ] `node -e "console.log(typeof require('cron-parser').parseExpression)"` 输出 `function`

---

## Step 5: Commit

```bash
git add super-tool-node/package.json super-tool-node/package-lock.json super-tool-node/config/config.default.ts super-tool-node/app/constants/errorCodes.ts
git commit -m "feat(notification): add p2.2 deps (rrule/cron-parser) + task config + 6 error codes

Refs: docs/analysis/通知推送系统模块设计需求文档.md (V2 §6.6)
Plan: docs/superpowers/plans/2026-05-30-notification-p2-2-task-schedule.md (Task 1)"
```

---

## Verification Checklist

- [ ] `package.json` 含 rrule + cron-parser
- [ ] `config.notification.task` 配置块完整
- [ ] errorCodes.ts 6 个新常量已添加 + 短别名映射
- [ ] commit 已提交

完成后进入 [`p2-2-02-migration.md`](./p2-2-02-migration.md)。
