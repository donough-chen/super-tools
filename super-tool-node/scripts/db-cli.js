#!/usr/bin/env node

/**
 * Super Tool Node - 交互式数据库 CLI
 *
 * 功能：
 *   1. 列出并执行 database/ 目录下的 .sql 文件
 *   2. 手动输入并执行 SQL 语句（支持多行，以 ; 结束）
 *   3. 查看当前数据库信息
 *   4. 查看所有数据表
 *
 * 使用：npm run db:cli
 */

'use strict';

const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

// ─────────────────────────── 颜色工具 ───────────────────────────

const c = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  bgRed: '\x1b[41m',
  bgGreen: '\x1b[42m',
};

const log = {
  info: (msg) => console.log(`${c.cyan}ℹ${c.reset} ${msg}`),
  success: (msg) => console.log(`${c.green}✔${c.reset} ${msg}`),
  warn: (msg) => console.log(`${c.yellow}⚠${c.reset} ${msg}`),
  error: (msg) => console.log(`${c.red}✖${c.reset} ${msg}`),
  title: (msg) => console.log(`\n${c.bold}${c.blue}${msg}${c.reset}`),
  dim: (msg) => console.log(`${c.dim}${msg}${c.reset}`),
};

// ─────────────────────────── 环境变量加载 ───────────────────────────

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
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

loadEnv();

// ─────────────────────────── 数据库配置 ───────────────────────────

const DB_CONFIG = {
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASS || '',
  multipleStatements: true, // 允许执行多条 SQL
  connectTimeout: 10000,
};

const DB_NAME = process.env.DB_NAME || 'superadmin_db';
const DATABASE_DIR = path.resolve(__dirname, '..', 'database');

// ─────────────────────────── readline 封装 ───────────────────────────

let rl;

function createRL() {
  rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: `${c.green}sql>${c.reset} `,
  });
  return rl;
}

function ask(question) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => resolve(answer.trim()));
  });
}

// ─────────────────────────── 表格格式化输出 ───────────────────────────

function printTable(rows) {
  if (!rows || rows.length === 0) {
    log.dim('  (空结果集)');
    return;
  }

  const columns = Object.keys(rows[0]);

  // 计算每列最大宽度
  const widths = {};
  for (const col of columns) {
    widths[col] = col.length;
  }
  for (const row of rows) {
    for (const col of columns) {
      const val = row[col] == null ? 'NULL' : String(row[col]);
      widths[col] = Math.min(60, Math.max(widths[col], val.length));
    }
  }

  // 分隔线
  const sep =
    '+-' + columns.map((col) => '-'.repeat(widths[col])).join('-+-') + '-+';

  // 表头
  const header =
    '| ' +
    columns
      .map((col) => col.padEnd(widths[col]))
      .join(' | ') +
    ' |';

  console.log(c.dim + sep + c.reset);
  console.log(c.bold + header + c.reset);
  console.log(c.dim + sep + c.reset);

  // 数据行（最多显示 200 行）
  const displayRows = rows.slice(0, 200);
  for (const row of displayRows) {
    const line =
      '| ' +
      columns
        .map((col) => {
          let val = row[col] == null ? 'NULL' : String(row[col]);
          if (val.length > 60) val = val.slice(0, 57) + '...';
          return val.padEnd(widths[col]);
        })
        .join(' | ') +
      ' |';
    console.log(line);
  }
  console.log(c.dim + sep + c.reset);

  if (rows.length > 200) {
    log.warn(`  结果共 ${rows.length} 行，仅显示前 200 行`);
  } else {
    log.dim(`  共 ${rows.length} 行`);
  }
}

// ─────────────────────────── 核心功能 ───────────────────────────

/** 扫描 database 目录下的 SQL 文件 */
function scanSqlFiles() {
  if (!fs.existsSync(DATABASE_DIR)) {
    return [];
  }
  return scanDir(DATABASE_DIR).sort();
}

function scanDir(dir, prefix = '') {
  const files = [];
  for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
    const rel = prefix ? `${prefix}/${item.name}` : item.name;
    if (item.isDirectory()) {
      files.push(...scanDir(path.join(dir, item.name), rel));
    } else if (item.name.endsWith('.sql')) {
      files.push(rel);
    }
  }
  return files;
}

/** 执行 SQL 并打印结果 */
async function executeSQL(conn, sql) {
  const trimmed = sql.trim();
  if (!trimmed) return;

  const startTime = Date.now();
  try {
    const [results] = await conn.query(trimmed);
    const elapsed = Date.now() - startTime;

    // 判断结果类型
    if (Array.isArray(results)) {
      // 多条语句时 results 是数组的数组
      if (results.length > 0 && Array.isArray(results[0])) {
        for (let i = 0; i < results.length; i++) {
          if (Array.isArray(results[i]) && results[i].length > 0) {
            log.title(`结果集 #${i + 1}`);
            printTable(results[i]);
          } else if (results[i] && results[i].affectedRows !== undefined) {
            log.success(
              `语句 #${i + 1}: 影响 ${results[i].affectedRows} 行, ` +
                `${results[i].changedRows || 0} 行变更`,
            );
          }
        }
      } else if (results.length > 0 && typeof results[0] === 'object' && !Buffer.isBuffer(results[0])) {
        // SELECT 查询结果
        printTable(results);
      } else {
        log.success(`执行完成，返回 ${results.length} 项`);
      }
    } else if (results && results.affectedRows !== undefined) {
      // INSERT / UPDATE / DELETE
      const parts = [];
      parts.push(`影响 ${results.affectedRows} 行`);
      if (results.changedRows) parts.push(`${results.changedRows} 行变更`);
      if (results.insertId) parts.push(`insertId = ${results.insertId}`);
      log.success(parts.join(', '));
    } else {
      log.success('执行完成');
    }

    log.dim(`  耗时 ${elapsed}ms`);
  } catch (err) {
    log.error(`SQL 执行错误: ${err.message}`);
    if (err.sqlState) {
      log.dim(`  SQLState: ${err.sqlState}, errno: ${err.errno}`);
    }
  }
}

/** 执行 SQL 文件 */
async function executeSqlFile(conn, filePath) {
  const fullPath = path.resolve(DATABASE_DIR, filePath);
  if (!fs.existsSync(fullPath)) {
    log.error(`文件不存在: ${fullPath}`);
    return;
  }

  const content = fs.readFileSync(fullPath, 'utf-8');
  const stats = fs.statSync(fullPath);
  const sizeKB = (stats.size / 1024).toFixed(1);

  log.title(`📄 执行文件: ${filePath} (${sizeKB} KB)`);
  log.dim(`  路径: ${fullPath}`);
  console.log();

  await executeSQL(conn, content);
}

// ─────────────────────────── 菜单选项 ───────────────────────────

function printBanner(conn) {
  console.log();
  console.log(
    `${c.bold}${c.cyan}╔══════════════════════════════════════════════╗${c.reset}`,
  );
  console.log(
    `${c.bold}${c.cyan}║     Super Tool Node - 数据库交互式 CLI      ║${c.reset}`,
  );
  console.log(
    `${c.bold}${c.cyan}╚══════════════════════════════════════════════╝${c.reset}`,
  );
  console.log();
}

function printHelp() {
  console.log();
  log.title('📋 可用命令:');
  console.log(
    `  ${c.yellow}\\l${c.reset}  ${c.dim}|${c.reset} ${c.yellow}\\list${c.reset}        列出 database/ 下所有 SQL 文件`,
  );
  console.log(
    `  ${c.yellow}\\r${c.reset}  ${c.dim}|${c.reset} ${c.yellow}\\run <n|名称>${c.reset} 执行指定 SQL 文件 (序号或文件名)`,
  );
  console.log(
    `  ${c.yellow}\\ra${c.reset} ${c.dim}|${c.reset} ${c.yellow}\\runall${c.reset}      依次执行所有 SQL 文件`,
  );
  console.log(
    `  ${c.yellow}\\d${c.reset}  ${c.dim}|${c.reset} ${c.yellow}\\tables${c.reset}      查看当前数据库所有表`,
  );
  console.log(
    `  ${c.yellow}\\dt <表名>${c.reset}           查看表结构 (DESC)`,
  );
  console.log(
    `  ${c.yellow}\\s${c.reset}  ${c.dim}|${c.reset} ${c.yellow}\\status${c.reset}      查看数据库连接状态`,
  );
  console.log(
    `  ${c.yellow}\\u${c.reset}  ${c.dim}|${c.reset} ${c.yellow}\\use <库名>${c.reset}   切换数据库`,
  );
  console.log(
    `  ${c.yellow}\\h${c.reset}  ${c.dim}|${c.reset} ${c.yellow}\\help${c.reset}        显示帮助`,
  );
  console.log(
    `  ${c.yellow}\\q${c.reset}  ${c.dim}|${c.reset} ${c.yellow}\\quit${c.reset}        退出`,
  );
  console.log();
  log.dim(
    '  直接输入 SQL 语句并按回车执行，多行语句以 ; 结尾后自动执行',
  );
  log.dim('  输入空行取消多行输入模式');
  console.log();
}

// ─────────────────────────── 主流程 ───────────────────────────

async function main() {
  createRL();
  printBanner();

  // 1. 连接数据库
  log.info(
    `正在连接 MySQL ${c.bold}${DB_CONFIG.user}@${DB_CONFIG.host}:${DB_CONFIG.port}${c.reset} ...`,
  );

  let conn;
  try {
    conn = await mysql.createConnection(DB_CONFIG);
    log.success('MySQL 连接成功');
  } catch (err) {
    log.error(`MySQL 连接失败: ${err.message}`);
    log.dim('  请检查 .env 中的 DB_HOST, DB_PORT, DB_USER, DB_PASS 配置');
    rl.close();
    process.exit(1);
  }

  // 2. 选择 / 创建数据库
  try {
    await conn.query(`CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    await conn.query(`USE \`${DB_NAME}\``);
    log.success(`当前数据库: ${c.bold}${DB_NAME}${c.reset}`);
  } catch (err) {
    log.warn(`切换数据库 ${DB_NAME} 失败: ${err.message}`);
  }

  printHelp();

  // 3. 交互循环
  let multiLineBuffer = '';
  let isMultiLine = false;

  const prompt = () => {
    if (isMultiLine) {
      rl.setPrompt(`${c.yellow}  ->${c.reset} `);
    } else {
      rl.setPrompt(`${c.green}sql>${c.reset} `);
    }
    rl.prompt();
  };

  prompt();

  rl.on('line', async (line) => {
    const input = line.trimEnd();

    // ───── 多行模式处理 ─────
    if (isMultiLine) {
      // 空行 => 取消多行
      if (input.trim() === '') {
        log.warn('多行输入已取消');
        multiLineBuffer = '';
        isMultiLine = false;
        prompt();
        return;
      }

      multiLineBuffer += '\n' + input;

      // 以分号结尾 => 执行
      if (input.trimEnd().endsWith(';')) {
        await executeSQL(conn, multiLineBuffer);
        multiLineBuffer = '';
        isMultiLine = false;
        prompt();
        return;
      }

      prompt();
      return;
    }

    const trimmed = input.trim();
    if (!trimmed) {
      prompt();
      return;
    }

    // ───── 命令处理 ─────
    const cmdMatch = trimmed.match(/^\\(\S+)\s*(.*)?$/);
    if (cmdMatch) {
      const cmd = cmdMatch[1].toLowerCase();
      const arg = (cmdMatch[2] || '').trim();

      switch (cmd) {
        case 'q':
        case 'quit':
        case 'exit': {
          log.info('再见 👋');
          await conn.end();
          rl.close();
          process.exit(0);
        }

        case 'h':
        case 'help': {
          printHelp();
          break;
        }

        case 'l':
        case 'list': {
          const files = scanSqlFiles();
          if (files.length === 0) {
            log.warn(`database/ 目录下没有找到 .sql 文件`);
          } else {
            log.title('📁 database/ 目录下的 SQL 文件:');
            files.forEach((f, i) => {
              const fullPath = path.resolve(DATABASE_DIR, f);
              const size = (fs.statSync(fullPath).size / 1024).toFixed(1);
              console.log(
                `  ${c.yellow}${String(i + 1).padStart(2)}.${c.reset} ${f} ${c.dim}(${size} KB)${c.reset}`,
              );
            });
            console.log();
            log.dim('  使用 \\r <序号> 或 \\r <文件名> 执行');
          }
          break;
        }

        case 'r':
        case 'run': {
          if (!arg) {
            log.warn('请指定文件序号或文件名，例如: \\r 1 或 \\r init.sql');
            break;
          }
          const files = scanSqlFiles();
          let target;

          // 按序号
          const num = parseInt(arg, 10);
          if (!isNaN(num) && num >= 1 && num <= files.length) {
            target = files[num - 1];
          } else {
            // 按文件名模糊匹配
            target = files.find(
              (f) =>
                f === arg ||
                f.endsWith('/' + arg) ||
                f.toLowerCase().includes(arg.toLowerCase()),
            );
          }

          if (!target) {
            log.error(`找不到匹配的文件: ${arg}`);
            log.dim('  使用 \\l 查看所有可用文件');
          } else {
            const confirm = await ask(
              `${c.yellow}确认执行 ${c.bold}${target}${c.reset}${c.yellow} ? (y/N): ${c.reset}`,
            );
            if (confirm.toLowerCase() === 'y' || confirm.toLowerCase() === 'yes') {
              await executeSqlFile(conn, target);
            } else {
              log.dim('  已取消');
            }
          }
          break;
        }

        case 'ra':
        case 'runall': {
          const files = scanSqlFiles();
          if (files.length === 0) {
            log.warn('没有找到 SQL 文件');
            break;
          }
          log.title(`将依次执行 ${files.length} 个文件:`);
          files.forEach((f, i) =>
            console.log(`  ${c.yellow}${i + 1}.${c.reset} ${f}`),
          );
          const confirm = await ask(
            `\n${c.yellow}确认执行以上所有文件? (y/N): ${c.reset}`,
          );
          if (confirm.toLowerCase() === 'y' || confirm.toLowerCase() === 'yes') {
            for (const file of files) {
              await executeSqlFile(conn, file);
              console.log();
            }
            log.success(`所有 ${files.length} 个文件执行完毕`);
          } else {
            log.dim('  已取消');
          }
          break;
        }

        case 'd':
        case 'tables': {
          await executeSQL(conn, 'SHOW TABLES');
          break;
        }

        case 'dt': {
          if (!arg) {
            log.warn('请指定表名，例如: \\dt users');
          } else {
            await executeSQL(conn, `DESC \`${arg}\``);
          }
          break;
        }

        case 's':
        case 'status': {
          try {
            const [rows] = await conn.query('SELECT DATABASE() AS db, USER() AS user, VERSION() AS version, NOW() AS time');
            log.title('📊 数据库连接状态:');
            console.log(
              `  ${c.dim}主机:${c.reset}     ${DB_CONFIG.host}:${DB_CONFIG.port}`,
            );
            console.log(
              `  ${c.dim}用户:${c.reset}     ${rows[0].user}`,
            );
            console.log(
              `  ${c.dim}数据库:${c.reset}   ${rows[0].db || '(未选择)'}`,
            );
            console.log(
              `  ${c.dim}版本:${c.reset}     MySQL ${rows[0].version}`,
            );
            console.log(
              `  ${c.dim}服务器时间:${c.reset} ${rows[0].time}`,
            );
          } catch (err) {
            log.error(`获取状态失败: ${err.message}`);
          }
          break;
        }

        case 'u':
        case 'use': {
          if (!arg) {
            log.warn('请指定数据库名，例如: \\u superadmin_db');
          } else {
            try {
              await conn.query(`USE \`${arg}\``);
              log.success(`已切换到数据库: ${c.bold}${arg}${c.reset}`);
            } catch (err) {
              log.error(`切换失败: ${err.message}`);
            }
          }
          break;
        }

        default: {
          log.warn(`未知命令: \\${cmd}，输入 \\h 查看帮助`);
        }
      }

      prompt();
      return;
    }

    // ───── SQL 语句执行 ─────
    // 以分号结尾 => 直接执行
    if (trimmed.endsWith(';')) {
      await executeSQL(conn, trimmed);
    } else {
      // 进入多行模式
      multiLineBuffer = trimmed;
      isMultiLine = true;
      log.dim('  (多行模式：以 ; 结尾执行，空行取消)');
    }

    prompt();
  });

  rl.on('close', async () => {
    try {
      await conn.end();
    } catch {
      // ignore
    }
    process.exit(0);
  });

  // Ctrl+C 优雅退出
  rl.on('SIGINT', async () => {
    if (isMultiLine) {
      multiLineBuffer = '';
      isMultiLine = false;
      console.log();
      log.warn('多行输入已取消');
      prompt();
    } else {
      console.log();
      log.info('再见 👋');
      try {
        await conn.end();
      } catch {
        // ignore
      }
      rl.close();
      process.exit(0);
    }
  });
}

main().catch((err) => {
  log.error(`启动失败: ${err.message}`);
  process.exit(1);
});
