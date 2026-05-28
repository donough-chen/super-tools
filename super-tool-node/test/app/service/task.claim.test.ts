/* eslint-disable @typescript-eslint/no-var-requires */
/**
 * B4: TaskService business fix tests (ASCII-only to avoid encoding issues)
 *  - claim expireAt check (spec 2.3-#9)
 *  - claim invite cap branch (spec 2.3-#10)
 *  - listUserTasks pagination (spec 2.3-#11)
 *  - listUserTasks required-level filtering (spec 2.3-#11)
 *
 * Note: uses ESM import to make this file a module and avoid TS script-mode
 *       global const collisions with other test files (no isolatedModules).
 */
import { app as appB4 } from 'egg-mock/bootstrap';
import * as assertB4 from 'assert';

describe('TaskService - B4 business fixes', () => {
  let userId: number;

  beforeEach(async () => {
    const u: any = await appB4.model.User.create({
      username: `task_b4_${Date.now()}_${Math.floor(Math.random() * 10000)}`,
      password: 'x',
    });
    userId = u.id;
    await appB4.model.UserMember.create({
      userId,
      levelId: 1,           // free, level=1
      levelCode: 'free',
      growthValue: 0,
      totalPoints: 0,
      points: 0,
    });
  });

  afterEach(async () => {
    // Cleanup temporary tasks inserted by tests
    await appB4.model.Task.destroy({
      where: { code: ['b4_invite_test', 'b4_diamond_only', 'b4_expire_test'] as any },
    });
    await appB4.model.TaskCompletionLog.destroy({ where: { userId } });
    await appB4.model.UserTask.destroy({ where: { userId } });
    await appB4.model.DailyPointsCap.destroy({ where: { userId } });
    await appB4.model.PointsLog.destroy({ where: { userId } });
    await appB4.model.UserMember.destroy({ where: { userId } });
    await appB4.model.User.destroy({ where: { id: userId } });
  });

  // ============================================================
  // 1. claim expireAt check
  // ============================================================
  describe('claim expireAt check', () => {
    it('expired completed task is rejected', async () => {
      const ctx = appB4.mockContext();
      // Insert a user_task with expireAt < now and status='completed'
      await appB4.model.UserTask.create({
        userId,
        taskCode: 'newbie_first_tool',
        cycleKey: 'once',
        progress: 1,
        status: 'completed',
        completedAt: new Date(Date.now() - 86_400_000 * 2),
        expireAt: new Date(Date.now() - 86_400_000), // 1 day ago
      });

      let err: any;
      try {
        await ctx.service.task.claim(userId, 'newbie_first_tool');
      } catch (e) { err = e; }
      assertB4.ok(err, 'should throw');
      // Server message contains the Chinese word for "expired"; match by HTTP status only
      assertB4.strictEqual(err.status, 400);
    });

    it('not-yet-expired completed task can be claimed', async () => {
      const ctx = appB4.mockContext();
      await appB4.model.UserTask.create({
        userId,
        taskCode: 'newbie_first_tool',
        cycleKey: 'once',
        progress: 1,
        status: 'completed',
        completedAt: new Date(),
        expireAt: new Date(Date.now() + 86_400_000), // 1 day in future
      });

      const r: any = await ctx.service.task.claim(userId, 'newbie_first_tool');
      assertB4.ok(r.points > 0, 'should claim successfully');
    });

    it('expireAt=null (never expire) can be claimed', async () => {
      const ctx = appB4.mockContext();
      await appB4.model.UserTask.create({
        userId,
        taskCode: 'newbie_first_tool',
        cycleKey: 'once',
        progress: 1,
        status: 'completed',
        completedAt: new Date(),
        expireAt: null,
      });

      const r: any = await ctx.service.task.claim(userId, 'newbie_first_tool');
      assertB4.ok(r.points > 0);
    });
  });

  // ============================================================
  // 2. claim invite daily cap
  // ============================================================
  describe('claim invite daily cap', () => {
    beforeEach(async () => {
      // Insert an ad-hoc invite-class task (no seed dependency)
      await appB4.model.Task.create({
        code: 'b4_invite_test',
        name: 'B4 invite test task',
        category: 'daily',
        triggerEvent: 'invite_success',
        progressTarget: 1,
        progressType: 1,
        rewardPoints: 50,
        rewardGrowth: 5,
        resetCycle: 'daily',
        dailyCapGroup: 'invite',
        sort: 9999,
        status: 1,
      });
    });

    it('daily invite count >= 5 (system_configs.daily_cap_invite=5) rejects claim', async () => {
      const { localTodayStr } = require('../../../app/lib/dateUtil');
      const ctx = appB4.mockContext();
      // Today already credited 5 invite rewards
      await appB4.model.DailyPointsCap.create({
        userId,
        capDate: localTodayStr(),
        capGroup: 'invite',
        earned: 250,
        count: 5,
      });
      // Insert a completed invite user_task
      await appB4.model.UserTask.create({
        userId,
        taskCode: 'b4_invite_test',
        cycleKey: localTodayStr(),
        progress: 1,
        status: 'completed',
        completedAt: new Date(),
      });

      let err: any;
      try {
        await ctx.service.task.claim(userId, 'b4_invite_test');
      } catch (e) { err = e; }
      assertB4.ok(err, 'should throw');
      assertB4.strictEqual(err.status, 400);
    });

    it('daily invite count < 5 normally claims and increments count', async () => {
      const { localTodayStr } = require('../../../app/lib/dateUtil');
      const ctx = appB4.mockContext();
      await appB4.model.DailyPointsCap.create({
        userId,
        capDate: localTodayStr(),
        capGroup: 'invite',
        earned: 100,
        count: 2,
      });
      await appB4.model.UserTask.create({
        userId,
        taskCode: 'b4_invite_test',
        cycleKey: localTodayStr(),
        progress: 1,
        status: 'completed',
        completedAt: new Date(),
      });

      const r: any = await ctx.service.task.claim(userId, 'b4_invite_test');
      assertB4.ok(r.points > 0, 'should claim successfully');

      const cap: any = await appB4.model.DailyPointsCap.findOne({
        where: { userId, capGroup: 'invite' },
      });
      assertB4.strictEqual(cap.count, 3, 'count should +1');
      assertB4.ok(cap.earned > 100, 'earned should accumulate');
    });
  });

  // ============================================================
  // 3. listUserTasks pagination
  // ============================================================
  describe('listUserTasks pagination', () => {
    it('returns {list, total, page, pageSize}', async () => {
      const ctx = appB4.mockContext();
      const r: any = await ctx.service.task.listUserTasks(userId, { page: 1, pageSize: 5 });
      assertB4.ok(Array.isArray(r.list), 'list must be array');
      assertB4.ok(typeof r.total === 'number', 'total must be number');
      assertB4.strictEqual(r.page, 1);
      assertB4.strictEqual(r.pageSize, 5);
      assertB4.ok(r.list.length <= 5, 'list <= pageSize');
    });

    it('default page=1, pageSize=20 when not provided', async () => {
      const ctx = appB4.mockContext();
      const r: any = await ctx.service.task.listUserTasks(userId, {});
      assertB4.strictEqual(r.page, 1);
      assertB4.strictEqual(r.pageSize, 20);
    });

    it('pageSize > 100 clamps to 100', async () => {
      const ctx = appB4.mockContext();
      const r: any = await ctx.service.task.listUserTasks(userId, { page: 1, pageSize: 999 });
      assertB4.strictEqual(r.pageSize, 100);
    });

    it('page=2 is non-overlapping with page=1', async () => {
      const ctx = appB4.mockContext();
      const r1: any = await ctx.service.task.listUserTasks(userId, { page: 1, pageSize: 2 });
      const r2: any = await ctx.service.task.listUserTasks(userId, { page: 2, pageSize: 2 });
      assertB4.ok(r1.list.length <= 2);
      assertB4.ok(r2.list.length <= 2);
      const codes1 = r1.list.map((x: any) => x.code);
      const codes2 = r2.list.map((x: any) => x.code);
      for (const c of codes2) {
        assertB4.ok(!codes1.includes(c), `code on page 2 (${c}) should not appear on page 1`);
      }
      assertB4.strictEqual(r1.total, r2.total, 'total stable across pages');
    });
  });

  // ============================================================
  // 4. listUserTasks required-level filter
  // ============================================================
  describe('listUserTasks required-level filter', () => {
    beforeEach(async () => {
      // Diamond-only ad-hoc task
      await appB4.model.Task.create({
        code: 'b4_diamond_only',
        name: 'B4 diamond-only test',
        category: 'achievement',
        triggerEvent: 'consume_milestone',
        progressTarget: 1000,
        progressType: 3,
        rewardPoints: 500,
        rewardGrowth: 50,
        resetCycle: 'once',
        requiredLevel: 'diamond',
        sort: 9998,
        status: 1,
      });
    });

    it('user level < requiredLevel hides the task', async () => {
      // current user is free (level=1); diamond is level=5
      const ctx = appB4.mockContext();
      const r: any = await ctx.service.task.listUserTasks(userId, { pageSize: 100 });
      const found = r.list.find((t: any) => t.code === 'b4_diamond_only');
      assertB4.strictEqual(found, undefined, 'free user should not see diamond task');
    });

    it('user level >= requiredLevel shows the task', async () => {
      const diamond: any = await appB4.model.MemberLevel.findOne({ where: { code: 'diamond' } });
      assertB4.ok(diamond, 'seed must contain diamond level');
      await appB4.model.UserMember.update(
        { levelId: diamond.id, levelCode: 'diamond' },
        { where: { userId } },
      );

      const ctx = appB4.mockContext();
      const r: any = await ctx.service.task.listUserTasks(userId, { pageSize: 100 });
      const found = r.list.find((t: any) => t.code === 'b4_diamond_only');
      assertB4.ok(found, 'diamond user should see diamond task');
    });

    it('requiredLevel=null is visible to all users', async () => {
      const ctx = appB4.mockContext();
      const r: any = await ctx.service.task.listUserTasks(userId, { pageSize: 100 });
      const newbie = r.list.find((t: any) => t.code === 'newbie_first_tool');
      assertB4.ok(newbie, 'requiredLevel=null task should be visible');
    });
  });
});
