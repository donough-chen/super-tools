/* eslint-disable @typescript-eslint/no-var-requires */
import { app } from 'egg-mock/bootstrap';
import * as assert from 'assert';

describe('TaskService - event-driven progress + claim', () => {
  let userId: number;

  beforeEach(async () => {
    const u: any = await app.model.User.create({
      username: `task_${Date.now()}_${Math.floor(Math.random() * 10000)}`,
      password: 'x',
    });
    userId = u.id;
    await app.model.UserMember.create({
      userId,
      levelId: 1,
      levelCode: 'free',
      growthValue: 0,
      totalPoints: 0,
      points: 0,
    });
  });

  afterEach(async () => {
    await app.model.TaskCompletionLog.destroy({ where: { userId } });
    await app.model.UserTask.destroy({ where: { userId } });
    await app.model.DailyPointsCap.destroy({ where: { userId } });
    await app.model.PointsLog.destroy({ where: { userId } });
    await app.model.UserMember.destroy({ where: { userId } });
    await app.model.User.destroy({ where: { id: userId } });
  });

  it('progress_type=1 计数累加：使用工具 1 次完成 newbie_first_tool', async () => {
    const ctx = app.mockContext();
    await ctx.service.task.onEvent({
      code: 'tool_used',
      userId,
      payload: { tool_code: 'json_format' },
    });
    const ut: any = await app.model.UserTask.findOne({
      where: { userId, taskCode: 'newbie_first_tool' },
    });
    assert.ok(ut);
    assert.strictEqual(ut.progress, 1);
    assert.strictEqual(ut.status, 'completed');
    // 同步生成了 completion log（pending）
    const comp: any = await app.model.TaskCompletionLog.findOne({
      where: { userTaskId: ut.id },
    });
    assert.ok(comp);
    assert.strictEqual(comp.status, 'pending');
  });

  it('progress_type=2 去重计数：daily_use_3_tools 使用 3 个不同工具完成', async () => {
    const ctx = app.mockContext();
    // 重复同一工具不计数增加
    for (let i = 0; i < 5; i++) {
      await ctx.service.task.onEvent({
        code: 'tool_used',
        userId,
        payload: { tool_code: 'json_format' },
      });
    }
    let ut: any = await app.model.UserTask.findOne({
      where: { userId, taskCode: 'daily_use_3_tools' },
    });
    assert.strictEqual(ut.progress, 1, '同一工具去重后只计 1');

    // 再用两个不同的工具
    await ctx.service.task.onEvent({
      code: 'tool_used',
      userId,
      payload: { tool_code: 'base64' },
    });
    await ctx.service.task.onEvent({
      code: 'tool_used',
      userId,
      payload: { tool_code: 'qrcode' },
    });
    ut = await app.model.UserTask.findOne({
      where: { userId, taskCode: 'daily_use_3_tools' },
    });
    assert.strictEqual(ut.progress, 3);
    assert.strictEqual(ut.status, 'completed');
  });

  it('progress_type=3 累计阈值：消费 100 元达成 achieve_consume_100', async () => {
    const ctx = app.mockContext();
    await ctx.service.task.onEvent({
      code: 'consume_milestone',
      userId,
      payload: { amount: 60 },
    });
    let ut: any = await app.model.UserTask.findOne({
      where: { userId, taskCode: 'achieve_consume_100' },
    });
    assert.strictEqual(ut.progress, 60);
    assert.strictEqual(ut.status, 'pending');

    await ctx.service.task.onEvent({
      code: 'consume_milestone',
      userId,
      payload: { amount: 50 },
    });
    ut = await app.model.UserTask.findOne({
      where: { userId, taskCode: 'achieve_consume_100' },
    });
    assert.strictEqual(ut.progress, 110);
    assert.strictEqual(ut.status, 'completed');
  });

  it('progress_type=4 直接覆盖：连续签到 streak=8 触发 achieve_sign_7', async () => {
    const ctx = app.mockContext();
    await ctx.service.task.onEvent({
      code: 'sign_streak',
      userId,
      payload: { streak: 8 },
    });
    const ut7: any = await app.model.UserTask.findOne({
      where: { userId, taskCode: 'achieve_sign_7' },
    });
    assert.strictEqual(ut7.progress, 8);
    assert.strictEqual(ut7.status, 'completed');

    // 连续签到 30/365 任务（progressTarget 30 / 365）应当 pending（progress=8 不达）
    const ut30: any = await app.model.UserTask.findOne({
      where: { userId, taskCode: 'achieve_sign_30' },
    });
    assert.strictEqual(ut30.progress, 8);
    assert.strictEqual(ut30.status, 'pending');
  });

  it('幂等：相同事件重复触发不重复完成', async () => {
    const ctx = app.mockContext();
    await ctx.service.task.onEvent({
      code: 'tool_used',
      userId,
      payload: { tool_code: 'json_format' },
    });
    await ctx.service.task.onEvent({
      code: 'tool_used',
      userId,
      payload: { tool_code: 'json_format' },
    });
    const ut: any = await app.model.UserTask.findOne({
      where: { userId, taskCode: 'newbie_first_tool' },
    });
    // 第二次触发已是 completed 状态，不会再 +1
    assert.strictEqual(ut.progress, 1);
    assert.strictEqual(ut.status, 'completed');
  });

  it('claim 应用任务加成（黄金 +10%）+ 写流水 + 更新 user_task 为 claimed', async () => {
    const ctx = app.mockContext();
    // 升到黄金：task_bonus_rate=0.10
    await app.model.UserMember.update(
      { levelId: 3, levelCode: 'gold', growthValue: 2000 },
      { where: { userId } },
    );

    // 完成 newbie_first_tool（reward_points=20）
    await ctx.service.task.onEvent({
      code: 'tool_used',
      userId,
      payload: { tool_code: 'json_format' },
    });

    const r: any = await ctx.service.task.claim(userId, 'newbie_first_tool');
    // 20 × 1.10 = 22
    assert.strictEqual(r.points, 22);
    assert.strictEqual(r.growth, 5);
    assert.ok(Math.abs(Number(r.bonusRate) - 1.10) < 0.001);

    const ut: any = await app.model.UserTask.findOne({
      where: { userId, taskCode: 'newbie_first_tool' },
    });
    assert.strictEqual(ut.status, 'claimed');
    assert.ok(ut.claimedAt);

    const comp: any = await app.model.TaskCompletionLog.findOne({
      where: { userTaskId: ut.id },
    });
    assert.strictEqual(comp.status, 'rewarded');
    assert.strictEqual(comp.rewardPoints, 22);

    const m: any = await app.model.UserMember.findOne({ where: { userId } });
    assert.strictEqual(m.points, 22);
    assert.strictEqual(m.growthValue, 2005);  // 原 2000 + 5
  });

  it('claim 重复领取报错', async () => {
    const ctx = app.mockContext();
    await ctx.service.task.onEvent({
      code: 'tool_used',
      userId,
      payload: { tool_code: 'json_format' },
    });
    await ctx.service.task.claim(userId, 'newbie_first_tool');
    let err: any;
    try { await ctx.service.task.claim(userId, 'newbie_first_tool'); } catch (e) { err = e; }
    assert.ok(err);
    assert.ok(/已领取/.test(err.message));
  });

  it('claim 任务未完成报错', async () => {
    const ctx = app.mockContext();
    let err: any;
    try { await ctx.service.task.claim(userId, 'newbie_first_tool'); } catch (e) { err = e; }
    assert.ok(err);
    assert.ok(/未达成|未完成/.test(err.message));
  });

  it('listUserTasks 返回任务进度（含 pending 与 completed）', async () => {
    const ctx = app.mockContext();
    await ctx.service.task.onEvent({
      code: 'tool_used',
      userId,
      payload: { tool_code: 'json_format' },
    });
    // B4: listUserTasks 返回 {list, total, page, pageSize}
    const r: any = await ctx.service.task.listUserTasks(userId, { category: 'newbie', pageSize: 100 });
    assert.ok(Array.isArray(r.list));
    assert.ok(typeof r.total === 'number');
    const first = r.list.find((x: any) => x.code === 'newbie_first_tool');
    assert.ok(first);
    assert.strictEqual(first.progress, 1);
    assert.strictEqual(first.status, 'completed');
  });

  it('expireNewbieTasks 把超时的 pending 改为 expired', async () => {
    const ctx = app.mockContext();
    // 手工塞一条已过期的 pending 任务
    await app.model.UserTask.create({
      userId, taskCode: 'newbie_profile', cycleKey: 'once',
      progress: 0, status: 'pending',
      expireAt: new Date(Date.now() - 86400000),  // 1 天前已过期
    });
    const updated: number = await ctx.service.task.expireNewbieTasks();
    assert.ok(updated >= 1);
    const ut: any = await app.model.UserTask.findOne({
      where: { userId, taskCode: 'newbie_profile' },
    });
    assert.strictEqual(ut.status, 'expired');
  });

  it('每日上限：daily_use_3_tools 是 daily_cap_group=task，领取计入 cap', async () => {
    const ctx = app.mockContext();
    // 让 daily_use_3_tools 完成（progressTarget=3）
    await ctx.service.task.onEvent({
      code: 'tool_used', userId,
      payload: { tool_code: 'a' },
    });
    await ctx.service.task.onEvent({
      code: 'tool_used', userId,
      payload: { tool_code: 'b' },
    });
    await ctx.service.task.onEvent({
      code: 'tool_used', userId,
      payload: { tool_code: 'c' },
    });
    await ctx.service.task.claim(userId, 'daily_use_3_tools');

    const cap: any = await app.model.DailyPointsCap.findOne({
      where: { userId, capGroup: 'task' },
    });
    assert.ok(cap);
    assert.strictEqual(cap.earned, 15);  // reward_points=15
    assert.strictEqual(cap.count, 1);
  });
});
