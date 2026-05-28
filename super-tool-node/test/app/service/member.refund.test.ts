/* eslint-disable @typescript-eslint/no-var-requires */
/**
 * B1 退款账本契约（review 锁定的 6 个 case）
 *
 * 设计依据: docs/superpowers/specs/2026-05-27-积分成长体系后端优化设计文档.md §2.7
 * 实施计划: docs/superpowers/plans/2026-05-27-积分成长体系后端优化-B业务修复实施计划.md §B1
 *
 * 统一前置（除 Case 6）：M=100，B=单批 60 分（B.points=60, B.pR=60, B.expireAt=2027-01-01）
 * 公式：
 *   recoverHere = min(R, B.points - B.pR)
 *   overflow    = R - recoverHere
 *   new M       = M + R                  // 余额一律加全 R（含 overflow）
 *   new B.pR    = B.pR + recoverHere     // 不超过 B.points
 *   refund 流水: points = -R, pointsRemaining = R, balance = new M, expireAt 继承 B.expireAt
 *
 * Q-D triggerEvent='mall_refund'；Q-B=a 允许 overflow 兜底；Q-C=a 继承原批次有效期。
 */
const { app } = require('egg-mock/bootstrap');
const assert = require('assert');

describe('MemberService - refundPoints (B1 反向 FIFO 账本契约)', () => {
  let userId: number;

  beforeEach(async () => {
    // 每 case 唯一用户，避免冲突
    const u: any = await app.model.User.create({
      username: `b1ref_${Date.now()}_${Math.floor(Math.random() * 100000)}`,
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
    // 打开 B1 新逻辑 flag
    await (app.model as any).query(
      "INSERT INTO `system_configs` (`group`,`key`,`value`,`type`,`is_secret`,`is_public`,`description`) " +
      "VALUES ('refund','reverse_fifo','true','boolean',0,0,'B1 flag') " +
      "ON DUPLICATE KEY UPDATE `value`='true'",
    );
    try { await (app as any).redis?.del('feature:refund_reverse_fifo'); } catch { /* ignore */ }
  });

  afterEach(async () => {
    await app.model.PointsLog.destroy({ where: { userId }, force: true });
    await app.model.UserMember.destroy({ where: { userId }, force: true });
    await app.model.User.destroy({ where: { id: userId }, force: true });
  });

  /**
   * 工具：建一个 60 分批次（已被消费 spent，剩 60-spent）
   * 返回 batch.id；同步更新 user_members.points = initialMember
   */
  async function setupBatch(initialMember: number, batchPoints = 60, spent = batchPoints, expireAt?: Date) {
    const b: any = await app.model.PointsLog.create({
      userId,
      type: 1,
      source: 'order_paid',
      points: batchPoints,
      balance: batchPoints,
      pointsRemaining: batchPoints - spent,
      growthDelta: 0,
      status: spent >= batchPoints ? 2 : 1,        // 全部消费完 → status=2
      sourceLevelId: 1,
      sourceEvent: 'first_consume',
      growthMultiplier: 1.0,
      expireAt: expireAt || new Date('2027-01-01'),
    });
    await app.model.UserMember.update({ points: initialMember }, { where: { userId } });
    return b.id as number;
  }

  // ===================== Case 1: 完整退款 =====================
  it('Case 1: 完整退款 60 → B.pR=60, M=100, refund.points=-60', async () => {
    const ctx = app.mockContext();
    const bId = await setupBatch(/* M */ 100, /* B */ 60, /* spent */ 60);

    const r: any = await (ctx.service as any).member.refundPoints(userId, bId, 60);

    const m: any = await app.model.UserMember.findOne({ where: { userId } });
    const b: any = await app.model.PointsLog.findByPk(bId);
    assert.strictEqual(b.pointsRemaining, 60, 'B.pR 应回写到 60');
    assert.strictEqual(b.status, 1, '回写后 status 应回到 1（可用）');
    assert.strictEqual(m.points, 100, 'M 应加全 R=60 后到 100');
    assert.strictEqual(r.balance, 100);

    const refund: any = await app.model.PointsLog.findByPk(r.logId);
    assert.strictEqual(refund.points, -60);
    assert.strictEqual(refund.pointsRemaining, 60, 'refund 流水自身可用额 = R');
    assert.strictEqual(refund.balance, 100);
    assert.strictEqual(refund.sourceEvent, 'mall_refund');
    assert.strictEqual(refund.bizType, 'refund');
    assert.strictEqual(refund.bizId, String(bId));
    assert.ok(refund.metadata, 'metadata 必填');
    assert.strictEqual(refund.metadata.scenario, 'B1_REFUND');
    assert.strictEqual(refund.metadata.originalLogId, bId);
    assert.strictEqual(refund.metadata.refundAmount, 60);
    assert.strictEqual(refund.metadata.recoverHere, 60);
    assert.strictEqual(refund.metadata.overflow, 0);
    // expireAt 继承
    const refundExpire = new Date(refund.expireAt).getTime();
    const bExpire = new Date(b.expireAt).getTime();
    assert.strictEqual(refundExpire, bExpire, 'refund.expireAt 应继承 B.expireAt');
  });

  // ===================== Case 2: 部分退款，B 已耗尽 =====================
  it('Case 2: 部分退款 30 → B.pR=30, M=70', async () => {
    const ctx = app.mockContext();
    const bId = await setupBatch(/* M */ 100, /* B */ 60, /* spent */ 60);

    const r: any = await (ctx.service as any).member.refundPoints(userId, bId, 30);

    const m: any = await app.model.UserMember.findOne({ where: { userId } });
    const b: any = await app.model.PointsLog.findByPk(bId);
    assert.strictEqual(b.pointsRemaining, 30);
    assert.strictEqual(m.points, 70);
    assert.strictEqual(r.balance, 70);
  });

  // ===================== Case 3: B 已过期 =====================
  it('Case 3: 原批次已过期，仍回写但 status 不复活 → B.pR=60 (status=3), M=100', async () => {
    const ctx = app.mockContext();
    // 设置一个已过期的批次（spent=60 + status=3）
    const b: any = await app.model.PointsLog.create({
      userId,
      type: 1,
      source: 'order_paid',
      points: 60,
      balance: 60,
      pointsRemaining: 0,
      growthDelta: 0,
      status: 3,                           // 3=已过期
      sourceLevelId: 1,
      sourceEvent: 'first_consume',
      growthMultiplier: 1.0,
      expireAt: new Date('2025-01-01'),    // 已过期
    });
    const bId = b.id;
    await app.model.UserMember.update({ points: 100 }, { where: { userId } });

    const r: any = await (ctx.service as any).member.refundPoints(userId, bId, 60);

    const m: any = await app.model.UserMember.findOne({ where: { userId } });
    const bAfter: any = await app.model.PointsLog.findByPk(bId);
    assert.strictEqual(bAfter.pointsRemaining, 60, 'B.pR 仍回写到 60（账本完整）');
    assert.strictEqual(bAfter.status, 3, '过期 status 不复活，FIFO 跳过');
    assert.strictEqual(m.points, 100, 'M 仍加全 R=60');
    assert.strictEqual(r.balance, 100);

    // refund 流水的 expireAt 继承（已过期），sourceEvent='mall_refund'
    const refund: any = await app.model.PointsLog.findByPk(r.logId);
    assert.ok(new Date(refund.expireAt).getTime() < Date.now(), 'refund.expireAt 应继承（已过期）');
    assert.strictEqual(refund.sourceEvent, 'mall_refund');
  });

  // ===================== Case 4: B 未耗尽时部分退款 =====================
  it('Case 4: B.pR=30 时退 20 → B.pR=50, M=90', async () => {
    const ctx = app.mockContext();
    // M=70, B.pR=30（消费了 30 的状态）
    const bId = await setupBatch(/* M */ 70, /* B */ 60, /* spent */ 30);

    const r: any = await (ctx.service as any).member.refundPoints(userId, bId, 20);

    const m: any = await app.model.UserMember.findOne({ where: { userId } });
    const b: any = await app.model.PointsLog.findByPk(bId);
    assert.strictEqual(b.pointsRemaining, 50);
    assert.strictEqual(b.status, 1);
    assert.strictEqual(m.points, 90);
    assert.strictEqual(r.balance, 90);

    const refund: any = await app.model.PointsLog.findByPk(r.logId);
    assert.strictEqual(refund.metadata.recoverHere, 20);
    assert.strictEqual(refund.metadata.overflow, 0);
  });

  // ===================== Case 5: overflow 走余额（Q-B=a 兜底） =====================
  it('Case 5: 退 80 > B 容量 60 → B.pR=60 (满), M=120, overflow=20', async () => {
    const ctx = app.mockContext();
    const bId = await setupBatch(/* M */ 100, /* B */ 60, /* spent */ 60);

    const r: any = await (ctx.service as any).member.refundPoints(userId, bId, 80);

    const m: any = await app.model.UserMember.findOne({ where: { userId } });
    const b: any = await app.model.PointsLog.findByPk(bId);
    assert.strictEqual(b.pointsRemaining, 60, 'B.pR 不超过 B.points=60');
    assert.strictEqual(m.points, 120, 'M = 100 + 80 (R 全额)');
    assert.strictEqual(r.balance, 120);

    const refund: any = await app.model.PointsLog.findByPk(r.logId);
    assert.strictEqual(refund.points, -80);
    assert.strictEqual(refund.pointsRemaining, 80);
    assert.strictEqual(refund.metadata.recoverHere, 60);
    assert.strictEqual(refund.metadata.overflow, 20);
  });

  // ===================== Case 6: 跨批次场景（仅退原批次 B1） =====================
  it('Case 6: 跨批次 B1 全消费 + B2 部分消费，退 B1 60 → B1.pR=60, B2 不动, M=70', async () => {
    const ctx = app.mockContext();
    // B1 全部消费完
    const b1: any = await app.model.PointsLog.create({
      userId,
      type: 1,
      source: 'order_paid',
      points: 60,
      balance: 60,
      pointsRemaining: 0,
      growthDelta: 0,
      status: 2,                            // 2=已耗尽
      sourceLevelId: 1,
      sourceEvent: 'first_consume',
      growthMultiplier: 1.0,
      expireAt: new Date('2027-01-01'),
    });
    // B2 部分消费（剩 10）
    const b2: any = await app.model.PointsLog.create({
      userId,
      type: 1,
      source: 'order_paid',
      points: 40,
      balance: 100,
      pointsRemaining: 10,
      growthDelta: 0,
      status: 1,
      sourceLevelId: 1,
      sourceEvent: 'first_consume',
      growthMultiplier: 1.0,
      expireAt: new Date('2027-06-01'),
    });
    await app.model.UserMember.update({ points: 10 }, { where: { userId } });

    // 仅退 B1 的 60
    const r: any = await (ctx.service as any).member.refundPoints(userId, b1.id, 60);

    const m: any = await app.model.UserMember.findOne({ where: { userId } });
    const b1After: any = await app.model.PointsLog.findByPk(b1.id);
    const b2After: any = await app.model.PointsLog.findByPk(b2.id);
    assert.strictEqual(b1After.pointsRemaining, 60, 'B1.pR 回写到满');
    assert.strictEqual(b1After.status, 1, 'B1 status 复活到 1');
    assert.strictEqual(b2After.pointsRemaining, 10, 'B2 不动');
    assert.strictEqual(b2After.status, 1);
    assert.strictEqual(m.points, 70, 'M = 10 + 60');
    assert.strictEqual(r.balance, 70);
  });

  // ===================== flag=false 时保持旧逻辑（双分支兼容） =====================
  it('flag=false 时走旧逻辑（status=4，不写 metadata）', async () => {
    // 关闭 B1 flag
    await (app.model as any).query(
      "UPDATE `system_configs` SET `value`='false' WHERE `group`='refund' AND `key`='reverse_fifo'",
    );
    try { await (app as any).redis?.del('feature:refund_reverse_fifo'); } catch { /* ignore */ }

    const ctx = app.mockContext();
    const bId = await setupBatch(/* M */ 100, /* B */ 60, /* spent */ 60);

    const r: any = await (ctx.service as any).member.refundPoints(userId, bId, 60);

    const b: any = await app.model.PointsLog.findByPk(bId);
    // 旧逻辑：原批次 pR 在 0 上扣不动 → 余下全扣会员余额，原批次 status 不变（保持 2）
    // 此处仅断言关键差异：metadata 应为 null（新字段，旧逻辑不写）
    const refund: any = await app.model.PointsLog.findByPk(r.logId);
    assert.strictEqual(refund.metadata, null, '旧逻辑不写 metadata');
    assert.strictEqual(refund.sourceEvent, 'refund', '旧逻辑保留旧 sourceEvent');
  });
});
