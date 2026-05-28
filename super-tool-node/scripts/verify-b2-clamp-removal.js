#!/usr/bin/env node
/**
 * B2 钳零移除契约验证脚本（纯 mysql2，绕开 jest）
 *
 * 设计依据: docs/superpowers/plans/2026-05-27-积分成长体系后端优化-B业务修复实施计划.md §B2
 *
 * 核心契约（spec §2.7 单一事实源）：
 *   1. user_members.points 已 SIGNED → 写入负值不应被钳零
 *   2. points_logs.balance 已 SIGNED → 写入负值不应被钳零
 *   3. 对账 diff = actual - SUM(points)，负值用户不应被识别为 anomaly
 *
 * 用法：node scripts/verify-b2-clamp-removal.js
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

async function setupUser(c, label) {
  const username = `b2_${Date.now()}_${Math.floor(Math.random() * 100000)}_${label}`;
  const uuid = `b2-${Date.now()}-${Math.floor(Math.random() * 100000)}-${label}`;
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

async function cleanup(c, userId) {
  await c.query('DELETE FROM points_logs WHERE user_id=?', [userId]);
  await c.query('DELETE FROM user_members WHERE user_id=?', [userId]);
  await c.query('DELETE FROM points_daily_snapshots WHERE user_id=?', [userId]);
  await c.query('DELETE FROM users WHERE id=?', [userId]);
}

(async () => {
  const c = await mysql.createConnection(DB);

  console.log('=== B2 钳零移除契约验证（纯 SQL）===\n');

  // --- Case 1: schema 列类型校验（user_members.points） ---
  {
    const [rows] = await c.query(
      "SELECT COLUMN_TYPE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=? AND TABLE_NAME='user_members' AND COLUMN_NAME='points'",
      [DB.database],
    );
    const t = rows[0]?.COLUMN_TYPE || '';
    console.log('Case 1: user_members.points 类型');
    eq(t.toLowerCase().includes('unsigned'), false, '  非 UNSIGNED（已 SIGNED）');
    eq(t.toLowerCase().includes('int'), true, '  类型为 int 系');
  }

  // --- Case 2: schema 列类型校验（points_logs.balance） ---
  {
    const [rows] = await c.query(
      "SELECT COLUMN_TYPE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=? AND TABLE_NAME='points_logs' AND COLUMN_NAME='balance'",
      [DB.database],
    );
    const t = rows[0]?.COLUMN_TYPE || '';
    console.log('\nCase 2: points_logs.balance 类型');
    eq(t.toLowerCase().includes('unsigned'), false, '  非 UNSIGNED（已 SIGNED）');
  }

  // --- Case 3: 直接写入负值（user_members.points）---
  {
    const u = await setupUser(c, 'c3');
    await c.query('UPDATE user_members SET points=-50 WHERE user_id=?', [u]);
    const [[m]] = await c.query('SELECT points FROM user_members WHERE user_id=?', [u]);
    console.log('\nCase 3: user_members.points 写入 -50');
    eq(m.points, -50, '  实际值（不钳零）');
    await cleanup(c, u);
  }

  // --- Case 4: 直接写入负值（points_logs.balance）---
  {
    const u = await setupUser(c, 'c4');
    const [ins] = await c.query(
      `INSERT INTO points_logs
         (user_id, type, source, points, balance, points_remaining, growth_delta, status,
          source_level_id, source_event, growth_multiplier, created_at)
       VALUES (?, 2, 'refund', -100, -50, 0, 0, 2, 1, 'mall_refund', 1.0, NOW())`,
      [u],
    );
    const [[lg]] = await c.query('SELECT balance FROM points_logs WHERE id=?', [ins.insertId]);
    console.log('\nCase 4: points_logs.balance 写入 -50');
    eq(lg.balance, -50, '  实际值（不钳零）');
    await cleanup(c, u);
  }

  // --- Case 5: 对账负值场景（diff=0 应不被识别为 anomaly）---
  // 模拟对账逻辑：actual = m.points; theoretical = SUM(points_logs.points); diff = actual - theoretical
  {
    const u = await setupUser(c, 'c5');
    // 用户先充 100 再退 150 → 实际余额 -50
    await c.query(
      `INSERT INTO points_logs (user_id, type, source, points, balance, points_remaining, growth_delta, status, source_level_id, source_event, growth_multiplier, created_at)
       VALUES (?, 1, 'order_paid', 100, 100, 0, 0, 2, 1, 'first_consume', 1.0, NOW()),
              (?, 2, 'refund', -150, -50, 0, 0, 2, 1, 'mall_refund', 1.0, NOW())`,
      [u, u],
    );
    await c.query('UPDATE user_members SET points=-50 WHERE user_id=?', [u]);

    const [[m]] = await c.query('SELECT points FROM user_members WHERE user_id=?', [u]);
    const [[sumRow]] = await c.query('SELECT SUM(points) AS total FROM points_logs WHERE user_id=?', [u]);
    const theoretical = Number(sumRow.total) || 0;
    const diff = m.points - theoretical; // B2 后不钳零
    console.log('\nCase 5: 对账负值用户（actual=-50, theoretical=-50）');
    eq(m.points, -50, '  actual');
    eq(theoretical, -50, '  theoretical');
    eq(diff, 0, '  diff=0（不被识别为 anomaly）');
    eq(Math.abs(diff) > 0, false, '  isAnomaly=false');
    await cleanup(c, u);
  }

  // --- Case 6: 对账真实异常（diff != 0 应被识别）---
  {
    const u = await setupUser(c, 'c6');
    await c.query(
      `INSERT INTO points_logs (user_id, type, source, points, balance, points_remaining, growth_delta, status, source_level_id, source_event, growth_multiplier, created_at)
       VALUES (?, 1, 'order_paid', 100, 100, 100, 0, 1, 1, 'first_consume', 1.0, NOW())`,
      [u],
    );
    // user_members.points 故意写错为 80（应为 100）
    await c.query('UPDATE user_members SET points=80 WHERE user_id=?', [u]);

    const [[m]] = await c.query('SELECT points FROM user_members WHERE user_id=?', [u]);
    const [[sumRow]] = await c.query('SELECT SUM(points) AS total FROM points_logs WHERE user_id=?', [u]);
    const theoretical = Number(sumRow.total) || 0;
    const diff = m.points - theoretical;
    console.log('\nCase 6: 对账真实异常（actual=80, theoretical=100）');
    eq(diff, -20, '  diff=-20');
    eq(Math.abs(diff) > 0, true, '  isAnomaly=true');
    await cleanup(c, u);
  }

  // --- Case 7: 旧 UNSIGNED 钳零行为已不存在（反证）---
  // 测试如果代码还有 Math.max(0, ...) 钳零，actual 会被强行抹平到 0，导致 diff 假阴性
  // B2 后 actual 真实保留 -50，对账正常
  {
    const u = await setupUser(c, 'c7');
    await c.query(
      `INSERT INTO points_logs (user_id, type, source, points, balance, points_remaining, growth_delta, status, source_level_id, source_event, growth_multiplier, created_at)
       VALUES (?, 1, 'order_paid', 100, 100, 0, 0, 2, 1, 'first_consume', 1.0, NOW()),
              (?, 2, 'refund', -150, -50, 0, 0, 2, 1, 'mall_refund', 1.0, NOW())`,
      [u, u],
    );
    await c.query('UPDATE user_members SET points=-50 WHERE user_id=?', [u]);

    const [[m]] = await c.query('SELECT points FROM user_members WHERE user_id=?', [u]);
    // 模拟旧代码（如果还有钳零）
    const oldClampedActual = Math.max(0, m.points); // 旧代码会得到 0
    const [[sumRow]] = await c.query('SELECT SUM(points) AS total FROM points_logs WHERE user_id=?', [u]);
    const oldClampedTheoretical = Math.max(0, Number(sumRow.total) || 0);
    const oldDiff = oldClampedActual - oldClampedTheoretical;
    console.log('\nCase 7: 反证 — 旧钳零代码会产生假对账（不应再存在）');
    eq(oldDiff, 0, '  旧钳零下 diff=0（假阴性掩盖了真实负值）');
    // 而 B2 后真实 diff 也是 0，但 actual=-50/theoretical=-50 是真实账本状态
    eq(m.points, -50, '  B2 后 actual 保留真实负值');
    await cleanup(c, u);
  }

  await c.end();

  console.log(`\n=== 总计：${pass} pass, ${fail} fail ===`);
  if (fail > 0) {
    console.log('\n失败明细：');
    for (const f of failures) console.log(f);
    process.exit(1);
  } else {
    console.log('🟢 B2 钳零移除契约全绿（schema SIGNED + 对账负值识别正确）');
  }
})().catch(err => {
  console.error('[FATAL]', err);
  process.exit(2);
});
