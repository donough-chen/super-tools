#!/usr/bin/env node
/**
 * 一次性 SQL 应用脚本
 * Usage: node scripts/apply-sql.js database/024_add_phase2_refund_upgrade.sql
 */
'use strict';

const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

function loadEnv() {
  const envPath = path.resolve(__dirname, '..', '.env');
  if (!fs.existsSync(envPath)) return;
  const content = fs.readFileSync(envPath, 'utf-8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIndex = trimmed.indexOf('=');
    if (eqIndex === -1) continue;
    const key = trimmed.slice(0, eqIndex).trim();
    const value = trimmed.slice(eqIndex + 1).trim();
    if (!process.env[key]) process.env[key] = value;
  }
}

loadEnv();

const sqlFile = process.argv[2];
if (!sqlFile) {
  console.error('[FAIL] missing arg: sql file path');
  process.exit(1);
}

const sqlPath = path.isAbsolute(sqlFile) ? sqlFile : path.resolve(process.cwd(), sqlFile);
if (!fs.existsSync(sqlPath)) {
  console.error('[FAIL] sql file not found:', sqlPath);
  process.exit(1);
}

(async () => {
  const sql = fs.readFileSync(sqlPath, 'utf-8');
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASS || '',
    multipleStatements: true,
    connectTimeout: 10000,
  });
  console.log('[INFO] connected, executing', path.basename(sqlPath), '...');
  try {
    const result = await conn.query(sql);
    const stmtCount = Array.isArray(result[0]) ? result[0].length : 1;
    console.log('[OK]', path.basename(sqlPath), 'applied (', stmtCount, 'statement results)');
  } catch (e) {
    console.error('[FAIL]', e.message);
    if (e.sql) console.error('[SQL]', e.sql.slice(0, 200));
    process.exitCode = 1;
  } finally {
    await conn.end();
  }
})();
