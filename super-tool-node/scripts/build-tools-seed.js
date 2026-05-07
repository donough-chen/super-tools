/**
 * build-tools-seed.js
 * -------------------------------------------------------------
 * 一次性脚本：从 test1.js 解析 11 个分类 + 全部工具，
 * 生成可内联到 database/004_add_tools_system.sql 的 SQL 片段。
 *
 * 输出：
 *   scripts/.tmp/tools-seed.sql   (tool_categories + tools INSERT)
 *
 * 用法：
 *   node scripts/build-tools-seed.js
 *
 * 注意：此脚本产物会被直接复制到 migration 文件中，归档后不再运行。
 * -------------------------------------------------------------
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const SRC = path.resolve(__dirname, '../test1.js');
const OUT_DIR = path.resolve(__dirname, '.tmp');
const OUT = path.join(OUT_DIR, 'tools-seed.sql');

if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

// 读取 test1.js 并注入到 sandbox，暴露 categorys / tools
const code = fs.readFileSync(SRC, 'utf8');
const sandbox = { module: {}, exports: {} };
const script = new vm.Script(code + '\n; this.__categorys = categorys; this.__tools = tools;');
const ctx = vm.createContext(sandbox);
script.runInContext(ctx);

const categorys = sandbox.__categorys;
const tools = sandbox.__tools;

if (!categorys || !tools) {
  console.error('[build-tools-seed] 解析失败：未能从 test1.js 提取 categorys / tools');
  process.exit(1);
}

// ---------- SQL 转义 ----------
function esc(v) {
  if (v === null || v === undefined) return 'NULL';
  if (typeof v === 'number') return String(v);
  return "'" + String(v).replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'";
}

// ---------- 分类 SQL ----------
const categoryCodes = Object.keys(categorys);
const categoryRows = categoryCodes.map((code, idx) => {
  const name = categorys[code];
  return `(${esc(code)}, ${esc(name)}, NULL, NULL, ${idx}, 1)`;
});

const categorySql =
  `-- 11 个工具分类（来源 test1.js 的 categorys 常量）\n` +
  `INSERT IGNORE INTO \`tool_categories\` (\`code\`, \`name\`, \`icon\`, \`description\`, \`sort\`, \`status\`) VALUES\n` +
  categoryRows.join(',\n') + ';\n';

// ---------- 工具 SQL ----------
// category_id 通过子查询确保与新插入的 tool_categories 对齐，不依赖自增顺序
// 按分类分组输出，便于阅读
const byCategory = {};
for (const t of tools) {
  if (!byCategory[t.category]) byCategory[t.category] = [];
  byCategory[t.category].push(t);
}

const toolInsertHead =
  `INSERT IGNORE INTO \`tools\`\n` +
  `  (\`code\`, \`name\`, \`description\`, \`keyword\`, \`category_id\`, \`category_code\`, \`icon\`, \`color\`, \`path\`,\n` +
  `   \`is_feature\`, \`required_level_code\`, \`require_paid\`, \`status\`, \`sort\`)\n` +
  `VALUES\n`;

let sortCounter = {}; // 每个分类内独立排序
const toolRows = [];
for (const t of tools) {
  sortCounter[t.category] = (sortCounter[t.category] || 0) + 1;
  const row =
    `(${esc(t.id)}, ${esc(t.name)}, ${esc(t.description || '')}, ${esc(t.keyword || '')},\n` +
    `   (SELECT id FROM \`tool_categories\` WHERE code=${esc(t.category)}), ${esc(t.category)},\n` +
    `   ${esc(t.icon || '')}, ${esc(t.color || '')}, ${esc(t.path || '')},\n` +
    `   0, 'free', 0, 1, ${sortCounter[t.category]})`;
  toolRows.push(row);
}

const toolSql =
  `-- ${tools.length} 个工具（来源 test1.js，全部默认 status=1 已发布、is_feature=0、required_level_code='free'、require_paid=0）\n` +
  toolInsertHead + toolRows.join(',\n') + ';\n';

// ---------- 写入 ----------
const out =
  '-- ============================================================\n' +
  '-- 自动生成的种子数据（请复制到 database/004_add_tools_system.sql）\n' +
  `-- 分类数: ${categoryCodes.length}   工具数: ${tools.length}\n` +
  `-- 生成时间: ${new Date().toISOString()}\n` +
  '-- ============================================================\n\n' +
  categorySql + '\n' + toolSql;

fs.writeFileSync(OUT, out, 'utf8');

console.log('[build-tools-seed] OK');
console.log(`  分类: ${categoryCodes.length} 个 (${categoryCodes.join(', ')})`);
console.log(`  工具: ${tools.length} 个`);
console.log(`  输出: ${OUT}`);
