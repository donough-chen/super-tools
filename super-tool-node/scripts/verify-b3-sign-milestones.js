#!/usr/bin/env node
/**
 * B3 sign.getSignStatus.milestones 契约验证脚本（纯 mysql2，绕开 jest）
 *
 * 设计依据: docs/superpowers/plans/2026-05-27-积分成长体系后端优化-B业务修复实施计划.md §B3
 *           docs/superpowers/specs/2026-05-27-积分成长体系后端优化设计文档.md §2.2-#6
 *
 * 核心契约：
 *   1. milestones 来自 tasks WHERE trigger_event='sign_streak' AND status=1
 *   2. 字段映射：{ streak: progress_target, points: reward_points, growth: reward_growth }
 *   3. 排序：按 progress_target ASC（H5 渲染 7→30→365）
 *   4. status=0 的 task 不应出现在结果中
 *   5. 其他 trigger_event 的 task 不应被串入
 *
 * 用法：node scripts/verify-b3-sign-milestones.js
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
 * 复刻 sign.getSignStatus 中 milestones 的 SQL 查询（使用与 service 完全一致的 SQL）
 */
async function loadMilestones(c) {
  const [rows] = await c.query(
    "SELECT progress_target, reward_points, reward_growth FROM tasks WHERE trigger_event='sign_streak' AND status=1 ORDER BY progress_target ASC",
  );
  return rows.map(t => ({
    streak: t.progress_target,
    points: t.reward_points,
    growth: t.reward_growth,
  }));
}

(async () => {
  const c = await mysql.createConnection(DB);

  console.log('=== B3 sign.getSignStatus.milestones 契约验证（纯 SQL）===\n');

  // --- Case 1: 真实种子数据完整性（确保 B3 上线时事实源就位）---
  {
    const milestones = await loadMilestones(c);
    console.log('Case 1: 种子数据完整性（DB 中至少 3 个 sign_streak 里程碑）');
    eq(milestones.length >= 3, true, `  milestones.length >= 3 (实际 ${milestones.length})`);
    // 默认契约：至少包含 7 / 30 / 365 三个标志性里程碑
    const streaks = milestones.map(m => m.streak);
    eq(streaks.includes(7), true, '  含 streak=7');
    eq(streaks.includes(30), true, '  含 streak=30');
    eq(streaks.includes(365), true, '  含 streak=365');
  }

  // --- Case 2: 排序契约（按 streak 升序）---
  {
    const milestones = await loadMilestones(c);
    console.log('\nCase 2: 排序契约（progress_target ASC）');
    let isAsc = true;
    for (let i = 1; i < milestones.length; i++) {
      if (milestones[i].streak < milestones[i - 1].streak) {
        isAsc = false;
        break;
      }
    }
    eq(isAsc, true, '  全部升序');
  }

  // --- Case 3: 字段映射契约（保证 H5 直接渲染的形状不变）---
  {
    const milestones = await loadMilestones(c);
    const m7 = milestones.find(m => m.streak === 7);
    console.log('\nCase 3: 字段映射契约（{streak, points, growth}）');
    eq(typeof m7.streak, 'number', '  streak 是 number');
    eq(typeof m7.points, 'number', '  points 是 number');
    eq(typeof m7.growth, 'number', '  growth 是 number');
    // 不允许返回数据库列名 progress_target / reward_points 直接外露
    eq('progress_target' in m7, false, '  无 progress_target 列名外露');
    eq('reward_points' in m7, false, '  无 reward_points 列名外露');
    eq('reward_growth' in m7, false, '  无 reward_growth 列名外露');
  }

  // --- Case 4: status=0 的 task 不应出现 ---
  {
    // 临时插入一个禁用的 sign_streak task
    const tmpCode = `_b3_test_disabled_${Date.now()}`;
    await c.query(
      `INSERT INTO tasks (code, name, category, trigger_event, progress_target, progress_type, reward_points, reward_growth, reset_cycle, sort, status, created_at, updated_at)
       VALUES (?, '禁用测试', 'achievement', 'sign_streak', 999, 4, 999, 999, 'once', 0, 0, NOW(), NOW())`,
      [tmpCode],
    );
    try {
      const milestones = await loadMilestones(c);
      const has999 = milestones.some(m => m.streak === 999);
      console.log('\nCase 4: status=0 的 task 不应出现');
      eq(has999, false, '  禁用 task 不在 milestones 中');
    } finally {
      await c.query('DELETE FROM tasks WHERE code=?', [tmpCode]);
    }
  }

  // --- Case 5: 其他 trigger_event 不应串入 ---
  {
    const tmpCode = `_b3_test_other_${Date.now()}`;
    await c.query(
      `INSERT INTO tasks (code, name, category, trigger_event, progress_target, progress_type, reward_points, reward_growth, reset_cycle, sort, status, created_at, updated_at)
       VALUES (?, '其他事件测试', 'achievement', 'invite_friend', 888, 1, 888, 888, 'once', 0, 1, NOW(), NOW())`,
      [tmpCode],
    );
    try {
      const milestones = await loadMilestones(c);
      const has888 = milestones.some(m => m.streak === 888);
      console.log('\nCase 5: 其他 trigger_event 不应串入');
      eq(has888, false, '  invite_friend task 不在 sign_streak milestones 中');
    } finally {
      await c.query('DELETE FROM tasks WHERE code=?', [tmpCode]);
    }
  }

  // --- Case 6: 真实种子值快照（提供完整审计输出）---
  {
    const milestones = await loadMilestones(c);
    console.log('\nCase 6: 真实种子值快照（仅展示，不断言具体数值）');
    for (const m of milestones) {
      console.log(`  streak=${m.streak}  points=${m.points}  growth=${m.growth}`);
    }
    pass++;
  }

  await c.end();

  console.log(`\n=== 总计：${pass} pass, ${fail} fail ===`);
  if (fail > 0) {
    console.log('\n失败明细：');
    for (const f of failures) console.log(f);
    process.exit(1);
  } else {
    console.log('🟢 B3 milestones 契约全绿');
  }
})().catch(err => {
  console.error('[FATAL]', err);
  process.exit(2);
});
