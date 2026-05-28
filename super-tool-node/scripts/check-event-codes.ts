/* eslint-disable */
// 一次性校验脚本：验证 EVENT_CODES 与 025/026 SQL 的 trigger_event 对齐
const fs = require('fs');
const path = require('path');
const codesMod = require('../app/lib/eventCodes');
const codes = codesMod.ALL_EVENT_CODES as string[];

const sqlText = [
  '025_points_growth_system_full.sql',
  '026_points_growth_system_optimization.sql',
].map(f => fs.readFileSync(path.join(__dirname, '..', 'database', f), 'utf8')).join('\n');

const found = new Set<string>();
for (const c of codes) {
  const re = new RegExp(`'${c}'`, 'g');
  if (re.test(sqlText)) found.add(c);
}
const unused = codes.filter(c => !found.has(c));

// 反向：SQL 里 trigger_event 列出现的所有 'xxx' 字符串
// 简单近似：抓所有 INSERT ... tasks 的行
const taskBlocks = sqlText.match(/INSERT[\s\S]*?INTO\s+`?tasks`?[\s\S]*?;\s*\n/gi) || [];
const sqlEvents = new Set<string>();
for (const block of taskBlocks) {
  // 找列定义里 trigger_event 的位置
  const colHead = /\(([^)]+)\)\s*VALUES/i.exec(block);
  if (!colHead) continue;
  const cols = colHead[1].split(',').map(s => s.replace(/[`\s]/g, ''));
  const idx = cols.indexOf('trigger_event');
  if (idx < 0) continue;
  // 抓 VALUES ( ... ) 多行行
  const valuesPart = block.substring(colHead.index + colHead[0].length);
  // 很粗：找每个 ( ... ),
  const rowRe = /\(([^()]*(?:\([^)]*\)[^()]*)*)\)/g;
  let m: RegExpExecArray | null;
  while ((m = rowRe.exec(valuesPart)) !== null) {
    const fields: string[] = [];
    let depth = 0; let cur = ''; const s = m[1];
    for (let i = 0; i < s.length; i++) {
      const ch = s[i];
      if (ch === '(') depth++;
      if (ch === ')') depth--;
      if (ch === ',' && depth === 0) { fields.push(cur); cur = ''; continue; }
      cur += ch;
    }
    fields.push(cur);
    const v = (fields[idx] || '').trim();
    const vm = /^'(.+)'$/.exec(v);
    if (vm) sqlEvents.add(vm[1]);
  }
}

const sqlEventsArr = [...sqlEvents].sort();
const missingInCodes = sqlEventsArr.filter(e => !codes.includes(e));

console.log('EVENT_CODES count       =', codes.length);
console.log('codes referenced in SQL =', [...found].sort());
console.log('codes NOT in any task   =', unused);
console.log('SQL trigger_event found =', sqlEventsArr);
console.log('MISSING in EVENT_CODES  =', missingInCodes.length === 0 ? 'NONE' : missingInCodes);
