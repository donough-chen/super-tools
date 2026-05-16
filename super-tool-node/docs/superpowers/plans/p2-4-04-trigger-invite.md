# P2.4-04：触发点 - 邀请好友成功（Task 4）

> 父计划：[2026-06-13-notification-p2-4-triggers-rollback.md](./2026-06-13-notification-p2-4-triggers-rollback.md)
> 前置：Task 1（type 已 seed）

---

## Step 1: 修改 `app/service/invite.ts`

> 假设 P1 已有 `confirmInvitee` 方法（被邀请人完成注册时调用）。在事务 commit 之后追加：

```typescript
// === P2.4 触发点：邀请好友成功通知 ===
try {
  // 通知邀请人
  await this.ctx.service.notification.send({
    typeKey: 'invite_success',
    userId: inviter.id,
    params: {
      inviteeName: invitee.nickname || invitee.mobile?.slice(-4) || '新用户',
      rewardPoints: rewardConfig.inviterPoints, // 例如 500
    },
    bizRefType: 'invite',
    bizRefId: `${inviter.id}-${invitee.id}`,
  });
} catch (e: any) {
  this.ctx.logger.warn(`[invite.success] notify failed: ${e.message}`);
}
```

> 若 `inviter` / `invitee` 变量名不同，按实际方法签名改。
> 该方法可能不在事务中（注册流程已完成）。如已在事务里，把通知挪到事务后。

---

## Step 2: 测试 `test/notification/trigger/invite-success.test.ts`

```typescript
import { app, mock, assert } from 'egg-mock/bootstrap';

describe('trigger/invite.success → notification.send', () => {
  it('被邀请人完成注册触发 notification.send (typeKey=invite_success)', async () => {
    const ctx = app.mockContext();
    let captured: any = null;
    mock(app.serviceClasses.notification.prototype, 'send', async (input: any) => {
      captured = input;
      return { skipped: false, messages: [{ id: 1, channel: 'inApp' }] };
    });

    const inviter = await ctx.model.User.create({
      mobile: '13800001111', nickname: 'Alice', status: 1,
    });
    const invitee = await ctx.model.User.create({
      mobile: '13800002222', nickname: 'Bob', status: 1,
    });

    // 调用业务接口（具体方法以项目实际为准）
    await ctx.service.invite.confirmInvitee({
      inviterId: inviter.id,
      inviteeId: invitee.id,
      inviteCode: 'TEST_CODE',
    });

    assert.ok(captured);
    assert.equal(captured.typeKey, 'invite_success');
    assert.equal(captured.userId, inviter.id);
    assert.equal(captured.params.inviteeName, 'Bob');
    assert.equal(captured.bizRefType, 'invite');
    assert.equal(captured.bizRefId, `${inviter.id}-${invitee.id}`);
  });

  it('notify 失败不影响业务返回', async () => {
    const ctx = app.mockContext();
    mock(app.serviceClasses.notification.prototype, 'send', async () => {
      throw new Error('notify down');
    });
    const inviter = await ctx.model.User.create({
      mobile: '13800001112', nickname: 'A2', status: 1,
    });
    const invitee = await ctx.model.User.create({
      mobile: '13800002223', nickname: 'B2', status: 1,
    });
    const r = await ctx.service.invite.confirmInvitee({
      inviterId: inviter.id, inviteeId: invitee.id, inviteCode: 'TEST_CODE_2',
    });
    assert.ok(r);
  });
});
```

---

## Step 3: 验证 & Commit

```bash
npm test -- --testPathPattern=trigger/invite-success
```

预期：2/2 PASS。

```bash
git add super-tool-node/app/service/invite.ts super-tool-node/test/notification/trigger/invite-success.test.ts
git commit -m "feat(notification): hook invite.confirmInvitee to notification.send

- invitee registration → notify inviter with typeKey=invite_success
- bizRefId = '{inviterId}-{inviteeId}' for idempotency
- 2 tests: happy path + failure isolation

Refs: docs/analysis/通知推送系统模块设计需求文档.md (V2 §11.2.6)
Plan: docs/superpowers/plans/2026-06-13-notification-p2-4-triggers-rollback.md (Task 4)"
```

---

## Verification Checklist

- [ ] `invite.ts` 含触发代码
- [ ] 2 用例 PASS
- [ ] commit 已提交

完成后进入 [`p2-4-05-trigger-tool.md`](./p2-4-05-trigger-tool.md)。
