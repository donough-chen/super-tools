# P2.4-03：触发点 - 会员升级 + 积分变动（Task 3）

> 父计划：[2026-06-13-notification-p2-4-triggers-rollback.md](./2026-06-13-notification-p2-4-triggers-rollback.md)
> 前置：Task 1（type 已 seed）

---

## Step 1: 修改 `app/service/member.ts`

### 1.1 在会员升级成功的方法末尾追加

> 假设 P1 已有 `upgradeMember` 方法（处理付费/续费/赠送）。在事务 commit 之后、return 之前追加：

```typescript
// === P2.4 触发点：会员升级通知 ===
try {
  const levelName = await this._loadLevelName(input.levelId); // 已有助手或现写
  await this.ctx.service.notification.send({
    typeKey: 'member_upgrade',
    userId: input.userId,
    params: {
      userName: user.nickname || user.mobile,
      levelName,
      upgradeAt: new Date().toLocaleString('zh-CN'),
      expireAt: new Date(newExpireAt).toLocaleString('zh-CN'),
    },
    bizRefType: 'member_subscription',
    bizRefId: String(subscription.id),
  });
} catch (e: any) {
  this.ctx.logger.warn(`[member.upgrade] notify failed: ${e.message}`);
}
```

### 1.2 在积分变动的方法末尾追加

> 假设 P1 已有 `addPoints` / `deductPoints` 等方法，或统一的 `applyPointsLog`。在写入 points_log 后追加：

```typescript
// === P2.4 触发点：积分变动通知 ===
const NOTIFY_THRESHOLD = 50; // 仅 ≥50 积分变动才通知，避免骚扰
if (Math.abs(amount) >= NOTIFY_THRESHOLD || isImportantReason(reason)) {
  try {
    await this.ctx.service.notification.send({
      typeKey: 'points_change',
      userId: input.userId,
      params: {
        action: amount > 0 ? '增加' : '扣减',
        amount: Math.abs(amount),
        balance: newBalance,
        reason,
      },
      bizRefType: 'points_log',
      bizRefId: String(pointsLog.id),
    });
  } catch (e: any) {
    this.ctx.logger.warn(`[member.pointsChange] notify failed: ${e.message}`);
  }
}
```

`isImportantReason` 辅助函数（写在文件顶部）：

```typescript
function isImportantReason(reason: string): boolean {
  return ['invite_success','sign_in_streak','task_completion','refund'].includes(reason);
}
```

---

## Step 2: 测试 `test/notification/trigger/member-upgrade.test.ts`

```typescript
import { app, mock, assert } from 'egg-mock/bootstrap';

describe('trigger/member.upgrade → notification.send', () => {
  it('会员升级成功后调用 notification.send (typeKey=member_upgrade)', async () => {
    const ctx = app.mockContext({ adminUser: { id: 1 } });
    let captured: any = null;
    mock(app.serviceClasses.notification.prototype, 'send', async (input: any) => {
      captured = input;
      return { skipped: false, messages: [{ id: 1, channel: 'inApp' }] };
    });

    // 准备 user + 触发升级（具体方法签名按项目实际）
    const user = await ctx.model.User.create({
      mobile: '13800000777', nickname: 'tester', status: 1,
    });
    await ctx.service.member.upgradeMember({
      userId: user.id, levelId: 3, source: 'purchase',
      orderId: 12345,
    });

    assert.ok(captured, 'notification.send should be called');
    assert.equal(captured.typeKey, 'member_upgrade');
    assert.equal(captured.userId, user.id);
    assert.equal(captured.bizRefType, 'member_subscription');
    assert.ok(captured.params.levelName);
  });

  it('notification.send 失败不影响业务返回', async () => {
    const ctx = app.mockContext({ adminUser: { id: 1 } });
    mock(app.serviceClasses.notification.prototype, 'send', async () => {
      throw new Error('notify down');
    });
    const user = await ctx.model.User.create({
      mobile: '13800000778', nickname: 'tester', status: 1,
    });
    const r = await ctx.service.member.upgradeMember({
      userId: user.id, levelId: 3, source: 'purchase', orderId: 12346,
    });
    // 业务方法应正常返回；不应抛错
    assert.ok(r);
  });
});
```

---

## Step 3: 测试 `test/notification/trigger/points-change.test.ts`

```typescript
import { app, mock, assert } from 'egg-mock/bootstrap';

describe('trigger/member.pointsChange → notification.send', () => {
  it('积分变动 >= 50 触发通知', async () => {
    const ctx = app.mockContext();
    let captured: any = null;
    mock(app.serviceClasses.notification.prototype, 'send', async (input: any) => {
      captured = input; return { skipped: false, messages: [] };
    });
    const user = await ctx.model.User.create({
      mobile: '13800000779', nickname: 'pt', status: 1,
    });
    await ctx.service.member.addPoints({
      userId: user.id, amount: 100, reason: 'task_completion',
    });
    assert.ok(captured);
    assert.equal(captured.typeKey, 'points_change');
    assert.equal(captured.params.action, '增加');
    assert.equal(captured.params.amount, 100);
  });

  it('积分变动 < 50 且非重要 reason 不触发', async () => {
    const ctx = app.mockContext();
    let called = false;
    mock(app.serviceClasses.notification.prototype, 'send', async () => {
      called = true; return { skipped: false, messages: [] };
    });
    const user = await ctx.model.User.create({
      mobile: '13800000780', nickname: 'pt2', status: 1,
    });
    await ctx.service.member.addPoints({
      userId: user.id, amount: 10, reason: 'browse_tool',
    });
    assert.equal(called, false);
  });

  it('扣减积分 → action=扣减', async () => {
    const ctx = app.mockContext();
    let captured: any = null;
    mock(app.serviceClasses.notification.prototype, 'send', async (input: any) => {
      captured = input; return { skipped: false, messages: [] };
    });
    const user = await ctx.model.User.create({
      mobile: '13800000781', nickname: 'pt3', status: 1, points: 200,
    });
    await ctx.service.member.deductPoints({
      userId: user.id, amount: 80, reason: 'refund',
    });
    assert.equal(captured.typeKey, 'points_change');
    assert.equal(captured.params.action, '扣减');
    assert.equal(captured.params.amount, 80);
  });
});
```

> 实际方法签名以项目 `member.ts` 为准；测试中如方法名不同，按实际改 `addPoints` / `deductPoints` 为对应名称。

---

## Step 4: 验证 & Commit

```bash
npm test -- --testPathPattern='trigger/member-upgrade|trigger/points-change'
```

预期：5 用例（2+3）全 PASS。

```bash
git add super-tool-node/app/service/member.ts super-tool-node/test/notification/trigger/member-upgrade.test.ts super-tool-node/test/notification/trigger/points-change.test.ts
git commit -m "feat(notification): hook member.upgrade & member.pointsChange to notification.send

- member.upgrade → typeKey=member_upgrade with level/upgradeAt/expireAt params
- pointsChange threshold 50 + important reasons whitelist (invite_success, etc.)
- bizRefType/bizRefId for idempotency
- notify failure does NOT break business (try/catch + warn log)
- 5 tests covering happy path / threshold filter / deduct path / failure isolation

Refs: docs/analysis/通知推送系统模块设计需求文档.md (V2 §11.2.7)
Plan: docs/superpowers/plans/2026-06-13-notification-p2-4-triggers-rollback.md (Task 3)"
```

---

## Verification Checklist

- [ ] `member.ts` 升级路径含触发代码
- [ ] `member.ts` 积分路径含阈值过滤
- [ ] 5 用例 PASS
- [ ] commit 已提交

完成后进入 [`p2-4-04-trigger-invite.md`](./p2-4-04-trigger-invite.md)（可与 03 / 05 并行）。
