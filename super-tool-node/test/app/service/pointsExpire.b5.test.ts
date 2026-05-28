/* eslint-disable @typescript-eslint/no-var-requires */
/**
 * B5: PointsExpireService business fix tests (ASCII-only to avoid encoding issues)
 *  - extendExpireOnUpgrade uses Sequelize.fn('GREATEST', col, val)   (spec 2.6-#18)
 *  - processExpiredBatches notifies with {points, date}              (spec 2.6-#19)
 *
 * Note: uses ESM import to make this file a module and avoid TS script-mode
 *       global const collisions with other test files (no isolatedModules).
 *       Following the same pattern as task.claim.test.ts (B4).
 */
import { app as appB5 } from 'egg-mock/bootstrap';
import * as assertB5 from 'assert';

describe('PointsExpireService - B5 business fixes', () => {
  let userId: number;

  beforeEach(async () => {
    const u: any = await appB5.model.User.create({
      username: `expire_b5_${Date.now()}_${Math.floor(Math.random() * 10000)}`,
      password: 'x',
    });
    userId = u.id;
    await appB5.model.UserMember.create({
      userId,
      levelId: 1,
      levelCode: 'free',
      growthValue: 0,
      totalPoints: 0,
      points: 0,
    });
  });

  afterEach(async () => {
    await appB5.model.PointsExpiryLog.destroy({ where: { userId } });
    await appB5.model.PointsLog.destroy({ where: { userId } });
    await appB5.model.UserMember.destroy({ where: { userId } });
    await appB5.model.User.destroy({ where: { id: userId } });
  });

  // ============================================================
  // 1. extendExpireOnUpgrade - GREATEST semantics via fn/col
  // ============================================================
  describe('extendExpireOnUpgrade GREATEST', () => {
    it('keeps the larger expireAt: existing far-future batch is unchanged', async () => {
      const ctx = appB5.mockContext();
      const farFuture = new Date(Date.now() + 365 * 86_400_000); // ~1 year
      const batch: any = await appB5.model.PointsLog.create({
        userId,
        type: 1,
        source: 'order',
        points: 100,
        balance: 100,
        growthDelta: 0,
        bizType: 'order',
        bizId: 'b5-far',
        remark: 'far',
        pointsRemaining: 100,
        status: 1,
        expireAt: farFuture,
      });

      // newRule says 30 days expiry; far-future (365d) should win the GREATEST
      const updated = await ctx.service.pointsExpire.extendExpireOnUpgrade(
        userId,
        { pointsExpireDays: 30 },
      );
      assertB5.ok(updated >= 1, 'should affect at least the matching batch');

      await batch.reload();
      // expireAt should still be ~ farFuture (within 5 second tolerance)
      const delta = Math.abs(new Date(batch.expireAt).getTime() - farFuture.getTime());
      assertB5.ok(
        delta < 5000,
        `far-future expireAt should be preserved (delta=${delta}ms)`,
      );
    });

    it('extends short-expire batch: existing near-future batch is pushed to NOW+newDays', async () => {
      const ctx = appB5.mockContext();
      const near = new Date(Date.now() + 5 * 86_400_000); // 5 days
      const batch: any = await appB5.model.PointsLog.create({
        userId,
        type: 1,
        source: 'order',
        points: 200,
        balance: 200,
        growthDelta: 0,
        bizType: 'order',
        bizId: 'b5-near',
        remark: 'near',
        pointsRemaining: 200,
        status: 1,
        expireAt: near,
      });

      const before = Date.now();
      await ctx.service.pointsExpire.extendExpireOnUpgrade(
        userId,
        { pointsExpireDays: 90 },
      );

      await batch.reload();
      const after = new Date(batch.expireAt).getTime();
      const expected = before + 90 * 86_400_000;
      // tolerance: 10 seconds for test execution drift
      assertB5.ok(
        Math.abs(after - expected) < 10_000,
        `near-future expireAt should be pushed to ~NOW+90d (after=${after}, expected=${expected})`,
      );
    });

    it('skips batches with expireAt=null (permanent)', async () => {
      const ctx = appB5.mockContext();
      const batch: any = await appB5.model.PointsLog.create({
        userId,
        type: 1,
        source: 'order',
        points: 50,
        balance: 50,
        growthDelta: 0,
        bizType: 'order',
        bizId: 'b5-perm',
        remark: 'perm',
        pointsRemaining: 50,
        status: 1,
        expireAt: null,
      });

      await ctx.service.pointsExpire.extendExpireOnUpgrade(
        userId,
        { pointsExpireDays: 365 },
      );

      await batch.reload();
      assertB5.strictEqual(
        batch.expireAt,
        null,
        'permanent batch (expireAt=null) should remain null',
      );
    });
  });

  // ============================================================
  // 2. processExpiredBatches - notify with {points} and aggregate per user
  // ============================================================
  describe('processExpiredBatches notification', () => {
    it('aggregates total expired per user and passes points in variables', async () => {
      const ctx = appB5.mockContext();
      const past = new Date(Date.now() - 86_400_000); // yesterday

      // Two expired batches for the same user (simulate FIFO order)
      await appB5.model.PointsLog.create({
        userId,
        type: 1,
        source: 'order',
        points: 30,
        balance: 30,
        growthDelta: 0,
        bizType: 'order',
        bizId: 'b5-exp-1',
        remark: 'exp1',
        pointsRemaining: 30,
        status: 1,
        expireAt: past,
      });
      await appB5.model.PointsLog.create({
        userId,
        type: 1,
        source: 'order',
        points: 70,
        balance: 100,
        growthDelta: 0,
        bizType: 'order',
        bizId: 'b5-exp-2',
        remark: 'exp2',
        pointsRemaining: 70,
        status: 1,
        expireAt: past,
      });
      // member.points should be set high enough to absorb both (avoid balance assertion noise)
      await appB5.model.UserMember.update(
        { points: 100 },
        { where: { userId } },
      );

      // Spy on notification.core.send to capture variables
      const sentCalls: any[] = [];
      const original = (ctx.service.notification as any).core.send.bind(
        (ctx.service.notification as any).core,
      );
      (ctx.service.notification as any).core.send = async (payload: any) => {
        sentCalls.push(payload);
        return { ok: true };
      };

      try {
        // Note: service is fetched via app.mockContext(); we need to use ctx.service path
        const r: any = await ctx.service.pointsExpire.processExpiredBatches();
        assertB5.ok(r.totalExpired >= 100, `totalExpired should be >=100, got ${r.totalExpired}`);
        assertB5.strictEqual(r.processedUsers, 1, 'should aggregate to 1 user');

        // Filter notifications belonging to our test user
        const ours = sentCalls.filter(
          (c: any) =>
            c?.typeCode === 'BUSINESS_POINTS_EXPIRED' && c?.userId === userId,
        );
        assertB5.strictEqual(ours.length, 1, 'one aggregated notification per user');
        const v = ours[0].variables || {};
        assertB5.ok(typeof v.points === 'number', 'variables.points should be a number');
        assertB5.ok(v.points >= 100, `variables.points should aggregate (got ${v.points})`);
        assertB5.ok(typeof v.date === 'string', 'variables.date should be a string');
      } finally {
        (ctx.service.notification as any).core.send = original;
      }
    });

    it('does not notify for batches that were already processed (idempotent skip)', async () => {
      const ctx = appB5.mockContext();
      const past = new Date(Date.now() - 86_400_000);

      const batch: any = await appB5.model.PointsLog.create({
        userId,
        type: 1,
        source: 'order',
        points: 40,
        balance: 40,
        growthDelta: 0,
        bizType: 'order',
        bizId: 'b5-exp-idem',
        remark: 'idem',
        pointsRemaining: 40,
        status: 1,
        expireAt: past,
      });
      // Pre-existing PointsExpiryLog -> the txn should return false (no-op)
      // Note: we still need a placeholder expiredLogId; create a dummy expired log row.
      const dummy: any = await appB5.model.PointsLog.create({
        userId,
        type: 3,
        source: 'points_expire',
        points: -40,
        balance: 0,
        growthDelta: 0,
        bizType: 'expire',
        bizId: String(batch.id),
        remark: 'pre-existing',
        pointsRemaining: 0,
        status: 3,
      });
      await appB5.model.PointsExpiryLog.create({
        userId,
        sourceLogId: batch.id,
        expiredPoints: 40,
        expiredLogId: dummy.id,
        executedAt: new Date(),
      });

      const sentCalls: any[] = [];
      const original = (ctx.service.notification as any).core.send.bind(
        (ctx.service.notification as any).core,
      );
      (ctx.service.notification as any).core.send = async (payload: any) => {
        sentCalls.push(payload);
        return { ok: true };
      };

      try {
        await ctx.service.pointsExpire.processExpiredBatches();
        const ours = sentCalls.filter(
          (c: any) =>
            c?.typeCode === 'BUSINESS_POINTS_EXPIRED' && c?.userId === userId,
        );
        assertB5.strictEqual(
          ours.length,
          0,
          'idempotent-hit batch should not trigger notification',
        );
      } finally {
        (ctx.service.notification as any).core.send = original;
      }
    });
  });
});
