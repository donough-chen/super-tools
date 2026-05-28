export {};
/* eslint-disable @typescript-eslint/no-var-requires */
const { app } = require('egg-mock/bootstrap');
const assert = require('assert');

describe('Points v2 model loading', () => {
  it('10 个新 model 全部加载成功', () => {
    const expected = [
      'Task', 'UserTask', 'TaskCompletionLog', 'UserSign',
      'PointsMallItem', 'PointsMallOrder', 'DailyPointsCap',
      'PointsExpiryLog', 'PointsExpiryNotice', 'PointsDailySnapshot',
    ];
    for (const name of expected) {
      assert.ok(app.model[name], `模型 ${name} 未加载`);
    }
  });

  it('PointsLog 已扩展 5 个 FIFO 字段', () => {
    const attrs = app.model.PointsLog.rawAttributes;
    assert.ok(attrs.pointsRemaining, 'pointsRemaining 字段缺失');
    assert.ok(attrs.status, 'status 字段缺失');
    assert.ok(attrs.sourceLevelId, 'sourceLevelId 字段缺失');
    assert.ok(attrs.sourceEvent, 'sourceEvent 字段缺失');
    assert.ok(attrs.growthMultiplier, 'growthMultiplier 字段缺失');
  });

  it('UserMember 已扩展 3 个签到字段', () => {
    const attrs = app.model.UserMember.rawAttributes;
    assert.ok(attrs.signStreak, 'signStreak 字段缺失');
    assert.ok(attrs.lastSignDate, 'lastSignDate 字段缺失');
    assert.ok(attrs.totalSignDays, 'totalSignDays 字段缺失');
  });

  it('Task 模型字段映射正确', () => {
    const attrs = app.model.Task.rawAttributes;
    assert.strictEqual(attrs.triggerEvent.field, 'trigger_event');
    assert.strictEqual(attrs.progressTarget.field, 'progress_target');
    assert.strictEqual(attrs.rewardPoints.field, 'reward_points');
    assert.strictEqual(attrs.dailyCapGroup.field, 'daily_cap_group');
  });

  it('PointsMallOrder 实物预留字段允许 null', () => {
    const attrs = app.model.PointsMallOrder.rawAttributes;
    assert.strictEqual(attrs.receiverName.allowNull, true);
    assert.strictEqual(attrs.receiverPhone.allowNull, true);
    assert.strictEqual(attrs.receiverAddress.allowNull, true);
    assert.strictEqual(attrs.expressCompany.allowNull, true);
    assert.strictEqual(attrs.expressNo.allowNull, true);
  });
});
