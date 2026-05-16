# P1-02：错误码扩展（Task 2）

> 子文件 2/12，对应 [P1 总览](./2026-05-16-notification-phase-1-00-overview.md) Task 2。

**Goal:** 在统一错误码常量中追加 108xxx 段，覆盖通知模块全部异常和业务跳过场景。

**Files:**
- Modify: `super-tool-node/app/constants/errorCodes.ts`

**前置依赖**：[Task 1](./p1-01-deps-config.md)

---

## Step 1: 追加 108xxx 错误码

- [ ] 修改 `super-tool-node/app/constants/errorCodes.ts`

在最后一个错误码 `FAVORITE_REORDER_MISMATCH` 之后、闭合的 `}` 之前追加以下 35 个新错误码：

```ts
  // 通知模块错误 108xxx
  // 模板相关 108001-108099
  NOTIFY_TEMPLATE_NOT_FOUND: { code: 108001, message: '模板不存在' },
  NOTIFY_TEMPLATE_NOT_PUBLISHED: { code: 108002, message: '模板未发布' },
  NOTIFY_TEMPLATE_HAS_TASKS: { code: 108003, message: '模板已被关联任务，不可删除' },
  NOTIFY_TEMPLATE_VAR_MISSING: { code: 108004, message: '模板渲染失败：变量缺失' },
  NOTIFY_TEMPLATE_SYNTAX: { code: 108005, message: '模板渲染失败：语法错误' },
  // 类型相关 108101-108199
  NOTIFY_TYPE_NOT_FOUND: { code: 108101, message: '通知类型不存在' },
  NOTIFY_TYPE_SYSTEM_LOCKED: { code: 108102, message: '系统内置类型不可修改/删除' },
  NOTIFY_TYPE_DISABLED: { code: 108103, message: '通知类型已停用' },
  NOTIFY_TYPE_KEY_DUPLICATED: { code: 108110, message: 'typeKey 已存在' },
  NOTIFY_TYPE_IN_USE: { code: 108111, message: '该类型仍有关联模板，禁止删除（请先停用）' },
  NOTIFY_TEMPLATE_ACTIVE_LOCKED: { code: 108112, message: '已启用模板不可直接修改，请创建新草稿' },
  // 受众相关 108201-108299
  NOTIFY_AUDIENCE_DYNAMIC_NOT_IMPL: { code: 108201, message: '动态受众解析能力 P2 提供' },
  NOTIFY_AUDIENCE_TYPE_INVALID: { code: 108202, message: '不支持的受众类型' },
  NOTIFY_AUDIENCE_NOT_FOUND: { code: 108210, message: '受众分组不存在' },
  NOTIFY_AUDIENCE_FIELD_INVALID: { code: 108211, message: '受众规则字段不在白名单' },
  NOTIFY_AUDIENCE_OP_INVALID: { code: 108212, message: '受众规则操作符非法' },
  // 任务相关 108301-108399
  NOTIFY_TASK_NOT_FOUND: { code: 108301, message: '任务不存在' },
  NOTIFY_TASK_STATUS_INVALID: { code: 108302, message: '任务状态不允许此操作' },
  NOTIFY_TASK_SCHEDULE_TOO_SOON: { code: 108303, message: '定时时间必须在 30 秒后' },
  NOTIFY_TASK_CRON_INVALID: { code: 108304, message: 'Cron 表达式非法' },
  // 消息相关 108401-108499
  NOTIFY_MESSAGE_NOT_FOUND: { code: 108401, message: '消息不存在或无权访问' },
  // 业务跳过 108501-108599（HTTP 200，仅业务标记）
  NOTIFY_SKIP_UNSUBSCRIBED: { code: 108501, message: '用户已取消订阅，跳过发送' },
  NOTIFY_SKIP_RATE_LIMITED: { code: 108502, message: '命中频控限制，跳过发送' },
  NOTIFY_SKIP_QUIET_HOUR: { code: 108503, message: '命中静默时段，跳过发送' },
  NOTIFY_SEND_DIRECT_NOT_ALLOWED: { code: 108504, message: 'sendDirect 仅允许验证码模板' },
  NOTIFY_BYPASS_PREFERENCE_NOT_ALLOWED: { code: 108505, message: 'bypassPreference 仅允许 P0 + 强制类型' },
  // 渠道相关 108601-108699
  NOTIFY_CHANNEL_CONFIG_INVALID: { code: 108601, message: '渠道服务商配置不存在或不可用' },
  NOTIFY_EMAIL_SEND_FAILED: { code: 108602, message: '邮件发送失败' },
  NOTIFY_SMS_SEND_FAILED: { code: 108603, message: '短信发送失败' },
  // 幂等 108701-108799
  NOTIFY_IDEMPOTENT_HIT: { code: 108701, message: '幂等键命中（24h 内重复）' },
  // 偏好 108801-108899
  NOTIFY_PREFERENCE_LOCKED: { code: 108801, message: '此类型不可关闭订阅' },
  // 队列/服务 108901-108999
  NOTIFY_QUEUE_UNAVAILABLE: { code: 108901, message: '队列连接异常' },
  NOTIFY_CHANNEL_DOWN: { code: 108902, message: '渠道整体降级中' },
```

> **段位规划说明**：每个子段（001/101/201...）预留 99 个号位用于未来扩展，不要跨段使用。

---

## Step 2: 验证 lint

- [ ] 运行 lint 检查

Run:

```bash
cd super-tool-node
npm run lint
```

Expected: 无新错误。

如有 TypeScript 错误（如 unused import 等）请按错误提示修复后重新 lint。

---

## Step 3: 验证可被引用

- [ ] 在任意 ts 文件临时验证导入

Run（临时验证，不需要 commit）：

```bash
cd super-tool-node
node -e "
  const { ErrorCodes } = require('./app/constants/errorCodes');
  console.log(ErrorCodes.NOTIFY_TEMPLATE_NOT_FOUND);
  console.log(ErrorCodes.NOTIFY_BYPASS_PREFERENCE_NOT_ALLOWED);
"
```

> 注：实际项目用 ts-node 才能 require ts 文件；如本地无 ts-node 可跳过此步，由 lint 通过即可视为类型正确。

Expected output（如能运行）：

```
{ code: 108001, message: '模板不存在' }
{ code: 108505, message: 'bypassPreference 仅允许 P0 + 强制类型' }
```

---

## Step 5: 短别名（可选）

为减少业务代码的常量名长度，在 `errorCodes.ts` 末尾导出便捷别名（推荐）：

```ts
/**
 * 通知模块错误码别名（业务代码内 ctx.throwBiz(NOTIF_ERR.TYPE_NOT_FOUND) 使用）
 * 仅作转发，与 ErrorCodes.NOTIFY_* 完全等价。
 */
export const NOTIF_ERR = {
  TEMPLATE_NOT_FOUND: ErrorCodes.NOTIFY_TEMPLATE_NOT_FOUND,
  TEMPLATE_NOT_PUBLISHED: ErrorCodes.NOTIFY_TEMPLATE_NOT_PUBLISHED,
  TEMPLATE_HAS_TASKS: ErrorCodes.NOTIFY_TEMPLATE_HAS_TASKS,
  TEMPLATE_VAR_MISSING: ErrorCodes.NOTIFY_TEMPLATE_VAR_MISSING,
  TEMPLATE_SYNTAX: ErrorCodes.NOTIFY_TEMPLATE_SYNTAX,
  TEMPLATE_ACTIVE_LOCKED: ErrorCodes.NOTIFY_TEMPLATE_ACTIVE_LOCKED,
  TYPE_NOT_FOUND: ErrorCodes.NOTIFY_TYPE_NOT_FOUND,
  TYPE_SYSTEM_LOCKED: ErrorCodes.NOTIFY_TYPE_SYSTEM_LOCKED,
  TYPE_DISABLED: ErrorCodes.NOTIFY_TYPE_DISABLED,
  TYPE_KEY_DUPLICATED: ErrorCodes.NOTIFY_TYPE_KEY_DUPLICATED,
  TYPE_IN_USE: ErrorCodes.NOTIFY_TYPE_IN_USE,
  AUDIENCE_DYNAMIC_NOT_IMPL: ErrorCodes.NOTIFY_AUDIENCE_DYNAMIC_NOT_IMPL,
  AUDIENCE_TYPE_INVALID: ErrorCodes.NOTIFY_AUDIENCE_TYPE_INVALID,
  AUDIENCE_NOT_FOUND: ErrorCodes.NOTIFY_AUDIENCE_NOT_FOUND,
  TASK_NOT_FOUND: ErrorCodes.NOTIFY_TASK_NOT_FOUND,
  TASK_STATUS_INVALID: ErrorCodes.NOTIFY_TASK_STATUS_INVALID,
  MESSAGE_NOT_FOUND: ErrorCodes.NOTIFY_MESSAGE_NOT_FOUND,
  CHANNEL_INVALID: ErrorCodes.NOTIFY_CHANNEL_INVALID,
  CHANNEL_CONFIG_INVALID: ErrorCodes.NOTIFY_CHANNEL_CONFIG_INVALID,
  EMAIL_SEND_FAILED: ErrorCodes.NOTIFY_EMAIL_SEND_FAILED,
  SMS_SEND_FAILED: ErrorCodes.NOTIFY_SMS_SEND_FAILED,
  IDEMPOTENT_HIT: ErrorCodes.NOTIFY_IDEMPOTENT_HIT,
  PREFERENCE_LOCKED: ErrorCodes.NOTIFY_PREFERENCE_LOCKED,
  QUEUE_UNAVAILABLE: ErrorCodes.NOTIFY_QUEUE_UNAVAILABLE,
  CHANNEL_DOWN: ErrorCodes.NOTIFY_CHANNEL_DOWN,
} as const;
```

> 后续 service / controller 代码中两种写法等价：
> - `ctx.throwBiz(ErrorCodes.NOTIFY_TYPE_NOT_FOUND)`
> - `ctx.throwBiz(NOTIF_ERR.TYPE_NOT_FOUND)`
>
> 本计划以 `NOTIF_ERR.*` 短别名为默认风格。

---

## Step 6: Commit

- [ ] 提交

```bash
git add super-tool-node/app/constants/errorCodes.ts
git commit -m "feat(notification): add 108xxx error codes for notification module

Add 28 new error codes covering:
- Templates (108001-108005)
- Types (108101-108102)
- Audiences (108201-108203)
- Tasks (108301-108304)
- Messages (108401)
- Business skips (108501-108505)
- Channels (108601-108603)
- Idempotency (108701)
- Preferences (108801)
- Queue/service (108901-108902)

Refs: docs/analysis/通知推送系统模块设计需求文档.md (V2 §5.6)"
```

---

## Verification Checklist

- [ ] `errorCodes.ts` 中含 28 个 `NOTIFY_*` 常量
- [ ] 每个常量的 `code` 字段在 108xxx 段
- [ ] `npm run lint` 通过
- [ ] git commit 已提交

完成本 Task 后请进入 [`p1-03-renderer.md`](./p1-03-renderer.md)。
