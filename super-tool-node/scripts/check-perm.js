'use strict';
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

const env = fs.readFileSync(path.resolve(__dirname, '..', '.env'), 'utf-8');
for (const ln of env.split('\n')) {
  const t = ln.trim();
  if (!t || t.startsWith('#')) continue;
  const i = t.indexOf('=');
  if (i < 0) continue;
  process.env[t.slice(0, i).trim()] = t.slice(i + 1).trim();
}

(async () => {
  const c = await mysql.createConnection({
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASS || '',
    database: process.env.DB_NAME || 'superadmin_db',
  });
  // 1) id=2 是什么
  const [r1] = await c.query("SELECT id, code, name, parent_id, type FROM permissions WHERE id IN (1,2,3) ORDER BY id");
  console.log('=== top permissions (id 1-3) ===');
  console.table(r1);
  // 2) 系统模块顶级菜单
  const [r2] = await c.query("SELECT id, code, name, parent_id, type FROM permissions WHERE module='system' AND (parent_id=0 OR code='system') ORDER BY parent_id, sort, id LIMIT 10");
  console.log('=== system module top-level ===');
  console.table(r2);
  // 3) system:dev 是否已存在
  const [r3] = await c.query("SELECT id, code, name, parent_id, type FROM permissions WHERE code = 'system:dev'");
  console.log('=== system:dev permission ===');
  console.table(r3);
  // 4) 当前 system:dev:trigger-schedule 状态
  const [r4] = await c.query("SELECT id, code, name, parent_id, type FROM permissions WHERE code = 'system:dev:trigger-schedule'");
  console.log('=== system:dev:trigger-schedule current ===');
  console.table(r4);
  await c.end();
})();
