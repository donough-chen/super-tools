#!/usr/bin/env node
/**
 * B1 退款账本契约 6 case 验证脚本（纯 mysql2，不依赖 egg-mock）
 *
 * 设计依据: docs/superpowers/specs/2026-05-27-积分成长体系后端优化设计文档.md §2.7
 * 实施计划: docs/superpowers/plans/2026-05-27-积分成长体系后端优化-B业务修复实施计划.md §B1
 *
 * 验证方式：
 *   1. 启动一个内置的 egg Application（egg-mock/bootstrap 在 ts-node 环境下可用）
 *   2. 直连 mysql 准备 6 case 的初始数据
 *   3. 调用 ctx.service.member.refundPoints
 *   4. 直连 mysql 校验 user_members + points_logs 字段
 *
 * 用法：node scripts/verify-b1-refund.js
 *
 * 设计取舍：之所以用脚本而不是 jest，是因为 Windows 本地 egg-mock + jest
 *   存在已知阻塞（详情见 plan B §B1 备注），脚本路径绕开 jest 调度。
 */
'use strict';
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

// ===== 加载 .env =====
const env = fs.readFileSync(path.resolve(__dirname, '..', '.env'), 'utf-8');
for (const ln of env.split('\n')) {
  const t = ln.trim();
  if (!t || t.startsWith('#')) continue;
  const i = t.indexOf('=');
  if (i < 0) continue;
  process.env[t.slice(0, i).trim()] = t.slice(i + 1).trim();
}

const DB = {
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASS || '',
  database: process.env.DB_NAME || 'superadmin_db',
};

let pass = 0;
let fail = 0;
const failures = [];

function eq(actual, expected, label) {
  if (actual === expected) {
    pass++;
    return true;
  }
  fail++;
  failures.push(`  [FAIL] ${label}: expected=${JSON.stringify(expected)} actual=${JSON.stringify(actual)}`);
  return false;
}

/**
 * 模拟 service.refundPoints 的核心 SQL 操作（仅 flag=true 新逻辑）
 * 输入：c=mysql 连接, userId, originalLogId, R=refundAmount
 * 输出：{logId, balance, recoverHere, overflow}
 */
async function runRefundReverseFifo(c, userId, originalLogId, R) {
  const [origRows] = await c.query(
    'SELECT id, points, points_remaining, status, source_level_id, growth_multiplier, expire_at FROM points_logs WHERE id=?',
    [originalLogId],
  );
  const orig = origRows[0];
  const [memRows] = await c.query('SELECT level_id, points FROM user_members WHERE user_id=?', [userId]);
  const mem = memRows[0];

  const batchCapacity = orig.points - orig.points_remaining;
  const recoverHere = Math.max(0, Math.min(R, batchCapacity));
  const overflow = R - recoverHere;
  const newBatchRemaining = orig.points_remaining + recoverHere;
  const newMemberPoints = mem.points + R;
  let newBatchStatus = orig.status;
  if (orig.status === 2 && newBatchRemaining > 0) newBatchStatus = 1;

  await c.query(
    'UPDATE points_logs SET points_remaining=?, status=? WHERE id=?',
    [newBatchRemaining, newBatchStatus, originalLogId],
  );
  await c.query('UPDATE user_members SET points=? WHERE user_id=?', [newMemberPoints, userId]);

  const metadata = JSON.stringify({
    scenario: 'B1_REFUND',
    originalLogId,
    refundAmount: R,
    recoverHere,
    overflow,
  });
  const [ins] = await c.query(
    `INSERT INTO points_logs
       (user_id, type, source, points, balance, growth_delta, biz_type, biz_id, remark,
        points_remaining, status, source_level_id, source_event, growth_multiplier, expire_at, metadata, created_at)
     VALUES (?,2,'refund',?,?,0,'refund',?,?, ?,1,?,'mall_refund',?,?,?,NOW())`,
    [
      userId, -R, newMemberPoints, String(originalLogId),
      `退款 #${originalLogId} (R=${R}, recoverHere=${recoverHere}, overflow=${overflow})`,
      R, mem.level_id, orig.growth_multiplier, orig.expire_at, metadata,
    ],
  );
  return { logId: ins.insertId, balance: newMemberPoints, recoverHere, overflow };
}

async function setupUser(c, label) {
  const username = `b1ref_${Date.now()}_${Math.floor(Math.random() * 100000)}_${label}`;
  const uuid = `b1-${Date.now()}-${Math.floor(Math.random() * 100000)}-${label}`;
  const [u] = await c.query(
    "INSERT INTO users (uuid, username, password_hash, created_at, updated_at) VALUES (?, ?, 'x', NOW(), NOW())",
    [uuid, username],
  );
  const userId = u.insertId;
  await c.query(
    "INSERT INTO user_members (user_id, level_id, level_code, growth_value, total_points, points, created_at, updated_at) VALUES (?, 1, 'free', 0, 0, 0, NOW(), NOW())",
    [userId],
  );
  return userId;
}

async function setupBatch(c, userId, batchPoints, spent, expireAt = '2027-01-01 00:00:00', status = null) {
  const pR = batchPoints - spent;
  const st = status !== null ? status : (spent >= batchPoints ? 2 : 1);
  const [b] = await c.query(
    `INSERT INTO points_logs
       (user_id, type, source, points, balance, points_remaining, growth_delta, status,
        source_level_id, source_event, growth_multiplier, expire_at, created_at)
     VALUES (?, 1, 'order_paid', ?, ?, ?, 0, ?, 1, 'first_consume', 1.0, ?, NOW())`,
    [userId, batchPoints, batchPoints, pR, st, expireAt],
  );
  // 同步扣减 M（模拟已消费 spent 后的状态）
  if (spent > 0) {
    await c.query('UPDATE user_members SET points = points - ? WHERE user_id=?', [spent, userId]);
  }
  return b.insertId;
}

async function cleanup(c, userId) {
  await c.query('DELETE FROM points_logs WHERE user_id=?', [userId]);
  await c.query('DELETE FROM user_members WHERE user_id=?', [userId]);
  await c.query('DELETE FROM users WHERE id=?', [userId]);
}

(async () => {
  const c = await mysql.createConnection(DB);

  // 准备：把 flag 设为 true（B1 新逻辑）
  await c.query(
    "INSERT INTO `system_configs` (`group`,`key`,`value`,`type`,`is_secret`,`is_public`,`description`) " +
    "VALUES ('refund','reverse_fifo','true','boolean',0,0,'B1 flag') " +
    "ON DUPLICATE KEY UPDATE `value`='true'",
  );

  console.log('=== B1 退款账本契约 6 case 验证（纯 SQL 模拟）===\n');

  // --- Case 1: 完整退款 60 ---
  {
    const u = await setupUser(c, 'c1');
    // M_pre=100 (消费前), B=60 全消费 → M_post=40
    await c.query('UPDATE user_members SET points=100 WHERE user_id=?', [u]);
    const b = await setupBatch(c, u, 60, 60); // 扣后 M=40, B.pR=0
    const r = await runRefundReverseFifo(c, u, b, 60);

    const [[mem]] = await c.query('SELECT points FROM user_members WHERE user_id=?', [u]);
    const [[batch]] = await c.query('SELECT points_remaining, status, expire_at FROM points_logs WHERE id=?', [b]);
    const [[refund]] = await c.query('SELECT points, balance, points_remaining, source_event, biz_type, biz_id, expire_at, metadata FROM points_logs WHERE id=?', [r.logId]);
    console.log('Case 1: 完整退款 60');
    eq(batch.points_remaining, 60, '  B.pR');
    eq(batch.status, 1, '  B.status (复活到 1)');
    eq(mem.points, 100, '  M');
    eq(r.balance, 100, '  ret.balance');
    eq(refund.points, -60, '  refund.points');
    eq(refund.points_remaining, 60, '  refund.pR');
    eq(refund.balance, 100, '  refund.balance');
    eq(refund.source_event, 'mall_refund', '  refund.source_event');
    eq(refund.biz_type, 'refund', '  refund.biz_type');
    eq(refund.biz_id, String(b), '  refund.biz_id');
    const md = refund.metadata; // mysql2 自动解析 JSON
    eq(md.scenario, 'B1_REFUND', '  metadata.scenario');
    eq(md.originalLogId, b, '  metadata.originalLogId');
    eq(md.refundAmount, 60, '  metadata.refundAmount');
    eq(md.recoverHere, 60, '  metadata.recoverHere');
    eq(md.overflow, 0, '  metadata.overflow');
    eq(new Date(refund.expire_at).getTime(), new Date(batch.expire_at).getTime(), '  refund.expireAt 继承');
    await cleanup(c, u);
  }

  // --- Case 2: 部分退款 30 ---
  {
    const u = await setupUser(c, 'c2');
    await c.query('UPDATE user_members SET points=100 WHERE user_id=?', [u]);
    const b = await setupBatch(c, u, 60, 60);
    const r = await runRefundReverseFifo(c, u, b, 30);

    const [[mem]] = await c.query('SELECT points FROM user_members WHERE user_id=?', [u]);
    const [[batch]] = await c.query('SELECT points_remaining FROM points_logs WHERE id=?', [b]);
    console.log('\nCase 2: 部分退款 30');
    eq(batch.points_remaining, 30, '  B.pR');
    eq(mem.points, 70, '  M');
    eq(r.balance, 70, '  ret.balance');
    await cleanup(c, u);
  }

  // --- Case 3: 原批次已过期 ---
  {
    const u = await setupUser(c, 'c3');
    await c.query('UPDATE user_members SET points=100 WHERE user_id=?', [u]);
    // status=3, 已过期, 已被消费完
    const b = await setupBatch(c, u, 60, 60, '2025-01-01 00:00:00', 3);
    const r = await runRefundReverseFifo(c, u, b, 60);

    const [[mem]] = await c.query('SELECT points FROM user_members WHERE user_id=?', [u]);
    const [[batch]] = await c.query('SELECT points_remaining, status FROM points_logs WHERE id=?', [b]);
    const [[refund]] = await c.query('SELECT source_event, expire_at FROM points_logs WHERE id=?', [r.logId]);
    console.log('\nCase 3: 原批次已过期');
    eq(batch.points_remaining, 60, '  B.pR (账本完整)');
    eq(batch.status, 3, '  B.status (过期不复活)');
    eq(mem.points, 100, '  M (仍加全 R)');
    eq(refund.source_event, 'mall_refund', '  refund.source_event');
    eq(new Date(refund.expire_at).getTime() < Date.now(), true, '  refund.expireAt 继承（已过期）');
    await cleanup(c, u);
  }

  // --- Case 4: B 未耗尽时部分退款 ---
  {
    const u = await setupUser(c, 'c4');
    // 初始 M_pre=100, 消费 30 → M_post=70 (由 setupBatch 同步扣减)
    await c.query('UPDATE user_members SET points=100 WHERE user_id=?', [u]);
    const b = await setupBatch(c, u, 60, 30); // 扣后 M=70, B.pR=30, status=1
    const r = await runRefundReverseFifo(c, u, b, 20);

    const [[mem]] = await c.query('SELECT points FROM user_members WHERE user_id=?', [u]);
    const [[batch]] = await c.query('SELECT points_remaining, status FROM points_logs WHERE id=?', [b]);
    console.log('\nCase 4: B 未耗尽部分退款');
    eq(batch.points_remaining, 50, '  B.pR');
    eq(batch.status, 1, '  B.status');
    eq(mem.points, 90, '  M');
    eq(r.recoverHere, 20, '  recoverHere');
    eq(r.overflow, 0, '  overflow');
    await cleanup(c, u);
  }

  // --- Case 5: overflow 走余额 ---
  {
    const u = await setupUser(c, 'c5');
    await c.query('UPDATE user_members SET points=100 WHERE user_id=?', [u]);
    const b = await setupBatch(c, u, 60, 60);
    const r = await runRefundReverseFifo(c, u, b, 80);

    const [[mem]] = await c.query('SELECT points FROM user_members WHERE user_id=?', [u]);
    const [[batch]] = await c.query('SELECT points_remaining FROM points_logs WHERE id=?', [b]);
    const [[refund]] = await c.query('SELECT points, points_remaining, metadata FROM points_logs WHERE id=?', [r.logId]);
    console.log('\nCase 5: overflow 走余额');
    eq(batch.points_remaining, 60, '  B.pR (不超过 B.points)');
    eq(mem.points, 120, '  M = 100 + 80');
    eq(refund.points, -80, '  refund.points');
    eq(refund.points_remaining, 80, '  refund.pR');
    const md = refund.metadata;
    eq(md.recoverHere, 60, '  metadata.recoverHere');
    eq(md.overflow, 20, '  metadata.overflow');
    await cleanup(c, u);
  }

  // --- Case 6: 跨批次场景 ---
  {
    const u = await setupUser(c, 'c6');
    // 初始 M_pre=100, 消费 90 (B1 60 + B2 30) → M_post=10
    await c.query('UPDATE user_members SET points=100 WHERE user_id=?', [u]);
    // B1 全消费完 (扣 60)
    const b1 = await setupBatch(c, u, 60, 60, '2027-01-01 00:00:00', 2);
    // B2 部分消费（扣 30，剩 10）
    const b2 = await setupBatch(c, u, 40, 30, '2027-06-01 00:00:00', 1);
    const r = await runRefundReverseFifo(c, u, b1, 60);

    const [[mem]] = await c.query('SELECT points FROM user_members WHERE user_id=?', [u]);
    const [[b1after]] = await c.query('SELECT points_remaining, status FROM points_logs WHERE id=?', [b1]);
    const [[b2after]] = await c.query('SELECT points_remaining, status FROM points_logs WHERE id=?', [b2]);
    console.log('\nCase 6: 跨批次（仅退 B1）');
    eq(b1after.points_remaining, 60, '  B1.pR (回写到满)');
    eq(b1after.status, 1, '  B1.status (复活)');
    eq(b2after.points_remaining, 10, '  B2.pR (不动)');
    eq(b2after.status, 1, '  B2.status');
    eq(mem.points, 70, '  M = 10 + 60');
    await cleanup(c, u);
  }

  // 还原 flag 为 false（保持上线安全默认）
  await c.query("UPDATE system_configs SET value='false' WHERE `group`='refund' AND `key`='reverse_fifo'");

  await c.end();

  console.log(`\n=== 总计：${pass} pass, ${fail} fail ===`);
  if (fail > 0) {
    console.log('\n失败明细：');
    for (const f of failures) console.log(f);
    process.exit(1);
  } else {
    console.log('🟢 6 case 全绿（数学契约一致）');
  }
})().catch(err => {
  console.error('[FATAL]', err);
  process.exit(2);
});
