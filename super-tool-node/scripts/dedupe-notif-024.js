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
    multipleStatements: true,
  });

  // 查重
  const [dups] = await c.query(
    "SELECT id FROM notification_types WHERE code='BUSINESS_PAYMENT_REFUNDED' ORDER BY id"
  );
  console.log('found rows:', dups.map((r) => r.id));
  if (dups.length <= 1) {
    console.log('no duplicates, skip');
    await c.end();
    return;
  }
  const keepId = dups[0].id;
  const removeIds = dups.slice(1).map((r) => r.id);
  console.log('keep id:', keepId, '/ remove ids:', removeIds);

  // 先看是否有 templates 关联了将被删除的 type id
  const [orphans] = await c.query(
    'SELECT id, code, type_id FROM notification_templates WHERE type_id IN (?)',
    [removeIds]
  );
  console.log('templates referencing removed types:', orphans.length);
  if (orphans.length > 0) {
    // 把它们重新指向 keepId
    const [u] = await c.query(
      'UPDATE notification_templates SET type_id = ? WHERE type_id IN (?)',
      [keepId, removeIds]
    );
    console.log('templates re-pointed:', u.affectedRows);
  }

  // 删除重复
  const [d] = await c.query(
    'DELETE FROM notification_types WHERE id IN (?)',
    [removeIds]
  );
  console.log('deleted duplicate notification_types:', d.affectedRows);

  await c.end();
})();
