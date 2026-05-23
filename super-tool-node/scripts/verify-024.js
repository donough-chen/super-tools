#!/usr/bin/env node
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
  const [r1] = await c.query("SHOW TABLES LIKE 'member_refunds'");
  const [r2] = await c.query("SHOW COLUMNS FROM member_orders LIKE 'source_%'");
  const [r3] = await c.query(
    "SELECT code FROM permissions WHERE code IN ('member:refund','member:refund:create','system:dev:trigger-schedule')"
  );
  const [r4] = await c.query("SELECT id, code, name, status FROM notification_types WHERE code='BUSINESS_PAYMENT_REFUNDED'");
  const [r5] = await c.query("SELECT code FROM notification_templates WHERE code='BUSINESS_PAYMENT_REFUNDED_INAPP'");
  const [r6] = await c.query(
    "SELECT `key`,`value` FROM system_configs WHERE `group`='payment' AND (`key` LIKE 'alipay%' OR `key`='enabled_providers') ORDER BY `key`"
  );
  const [r7] = await c.query(
    "SELECT r.code AS role, p.code AS perm FROM role_permissions rp INNER JOIN roles r ON rp.role_id = r.id INNER JOIN permissions p ON rp.permission_id = p.id WHERE p.code IN ('member:refund','member:refund:create','system:dev:trigger-schedule') ORDER BY r.code, p.code"
  );
  console.log('=== 024 verification ===');
  console.log('member_refunds table exists  :', r1.length === 1 ? '[OK]' : '[FAIL]');
  console.log('source_* columns added       :', r2.length === 2 ? '[OK]' : '[FAIL]', '(' + r2.length + '/2)');
  console.log('permissions                  :', r3.length === 3 ? '[OK]' : '[FAIL]', r3.map((r) => r.code).join(','));
  console.log('notification_type            :', r4.length === 1 ? '[OK]' : '[FAIL]', JSON.stringify(r4));
  console.log('notification_template        :', r5.length === 1 ? '[OK]' : '[FAIL]');
  console.log('payment configs              :');
  for (const row of r6) console.log('  ', row.key, '=', row.value);
  console.log('role_permissions             :');
  for (const row of r7) console.log('  ', row.role, '->', row.perm);
  await c.end();
})();
