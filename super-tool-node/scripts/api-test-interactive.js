#!/usr/bin/env node
/**
 * Super Tool Node - 自动化测试交互脚本系统
 *
 * 功能：
 *   1. 自动扫描 router.ts 和 controller 文件，提取所有 API 端点信息
 *   2. 按控制器模块分类，交互式选择运行测试
 *   3. 生成/更新各模块的 API 前端调用示例文档（docs/api/{模块}/）
 *   4. 检测接口变更并同步测试文件骨架
 *   5. 支持批量全模块操作
 *   6. 实时监控文件变化自动触发更新（--watch 模式）
 *
 * 使用：
 *   node scripts/api-test-interactive.js
 *   node scripts/api-test-interactive.js --watch
 *   node scripts/api-test-interactive.js --all-docs
 *   node scripts/api-test-interactive.js --all-test
 */

'use strict';

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { execSync, spawn } = require('child_process');

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
  bgBlue: '\x1b[44m',
};

const log = {
  info:    (msg) => console.log(`${c.cyan}ℹ${c.reset}  ${msg}`),
  success: (msg) => console.log(`${c.green}✔${c.reset}  ${msg}`),
  warn:    (msg) => console.log(`${c.yellow}⚠${c.reset}  ${msg}`),
  error:   (msg) => console.log(`${c.red}✖${c.reset}  ${msg}`),
  title:   (msg) => console.log(`\n${c.bold}${c.bgBlue}${c.white}  ${msg}  ${c.reset}\n`),
  section: (msg) => console.log(`\n${c.bold}${c.blue}── ${msg} ──${c.reset}`),
  dim:     (msg) => console.log(`${c.dim}${msg}${c.reset}`),
  blank:   ()    => console.log(''),
};

// ─────────────────────────── 路径常量 ───────────────────────────

const ROOT        = path.resolve(__dirname, '..');
const ROUTER_FILE = path.join(ROOT, 'app', 'router.ts');
const CTRL_DIR    = path.join(ROOT, 'app', 'controller');
const TEST_DIR    = path.join(ROOT, 'test');
const DOCS_DIR    = path.join(ROOT, 'docs', 'api');

// ─────────────────────────── 模块定义 ───────────────────────────
// 每个模块对应：控制器文件、测试文件、路由前缀、显示名称

const MODULES = {
  auth: {
    label:      '认证模块 (Auth)',
    ctrlFiles:  ['auth.ts'],
    testFile:   'api/auth.test.ts',
    routePrefix: '/api/auth',
    docsDir:    'auth',
  },
  user: {
    label:      '用户模块 (User)',
    ctrlFiles:  ['user.ts'],
    testFile:   'api/user.test.ts',
    routePrefix: '/api/users',
    docsDir:    'user',
  },
  role: {
    label:      '角色管理 (Role)',
    ctrlFiles:  ['admin/role.ts'],
    testFile:   'api/role.test.ts',
    routePrefix: '/api/admin/roles',
    docsDir:    'role',
  },
  permission: {
    label:      '权限管理 (Permission)',
    ctrlFiles:  ['admin/permission.ts'],
    testFile:   'api/permission.test.ts',
    routePrefix: '/api/admin/permissions',
    docsDir:    'permission',
  },
  dashboard: {
    label:      '仪表盘 (Dashboard)',
    ctrlFiles:  ['admin/dashboard.ts'],
    testFile:   'api/dashboard.test.ts',
    routePrefix: '/api/admin/dashboard',
    docsDir:    'dashboard',
  },
  member: {
    label:      '会员模块 (Member)',
    ctrlFiles:  ['member.ts', 'admin/member.ts'],
    testFile:   'api/member.test.ts',
    routePrefix: '/api/member',
    docsDir:    'member',
  },
  favorite: {
    label:      '收藏模块 (Favorite)',
    ctrlFiles:  ['favorite.ts'],
    testFile:   'api/favorite.test.ts',
    routePrefix: '/api/favorites',
    docsDir:    'favorite',
  },
  e2e: {
    label:      'E2E 流程测试',
    ctrlFiles:  [],
    testFile:   'e2e/flow.test.ts',
    routePrefix: null,
    docsDir:    null,
  },
};

// ─────────────────────────── 路由解析 ───────────────────────────

/**
 * 解析 router.ts，提取所有路由定义
 * 返回：[{ method, path, controller, needsAuth }]
 */
function parseRouter() {
  const content = fs.readFileSync(ROUTER_FILE, 'utf-8');
  const routes = [];

  // 匹配：router.METHOD('path', [auth,] controller.xxx.yyy)
  const re = /router\.(get|post|put|delete|patch)\(\s*'([^']+)'(?:,\s*auth)?(?:,\s*(controller\.[^\)]+))?\)/g;
  let m;
  while ((m = re.exec(content)) !== null) {
    const method = m[1].toUpperCase();
    const routePath = m[2];
    const ctrl = (m[3] || '').trim().replace(/,$/, '');
    const needsAuth = content.slice(m.index, m.index + m[0].length).includes(', auth,');

    // 判断所属模块
    let module = 'unknown';
    for (const [key, mod] of Object.entries(MODULES)) {
      if (mod.routePrefix && routePath.startsWith(mod.routePrefix)) {
        module = key;
        break;
      }
    }
    // health check 特殊处理
    if (routePath === '/api/health') module = 'auth';

    routes.push({ method, path: routePath, controller: ctrl, needsAuth, module });
  }

  return routes;
}

/**
 * 按模块分组路由
 */
function groupRoutesByModule(routes) {
  const groups = {};
  for (const route of routes) {
    if (!groups[route.module]) groups[route.module] = [];
    groups[route.module].push(route);
  }
  return groups;
}

// ─────────────────────────── 测试同步模块 ───────────────────────────

/**
 * 检查测试文件中已覆盖的路由
 * 返回：Set<string>  格式 "METHOD /path"
 */
function getTestedRoutes(testFilePath) {
  const fullPath = path.join(TEST_DIR, testFilePath);
  if (!fs.existsSync(fullPath)) return new Set();

  const content = fs.readFileSync(fullPath, 'utf-8');
  const covered = new Set();

  // 匹配 .get/.post/.put/.delete('/api/...')
  const re = /\.(get|post|put|delete|patch)\(`?'?([^'`\)]+)`?'?\)/g;
  let m;
  while ((m = re.exec(content)) !== null) {
    const method = m[1].toUpperCase();
    const p = m[2].replace(/\$\{[^}]+\}/g, ':id'); // 模板字符串 → :id
    covered.add(`${method} ${p}`);
  }
  return covered;
}

/**
 * 对比路由与测试文件，找出未覆盖的接口
 */
function findUncoveredRoutes(moduleKey) {
  const mod = MODULES[moduleKey];
  if (!mod || !mod.testFile) return [];

  const allRoutes = parseRouter();
  const moduleRoutes = allRoutes.filter(r => r.module === moduleKey);
  const covered = getTestedRoutes(mod.testFile);

  return moduleRoutes.filter(r => {
    const key = `${r.method} ${r.path}`;
    return !covered.has(key);
  });
}

/**
 * 为未覆盖的路由生成测试骨架代码片段
 */
function generateTestSkeleton(route) {
  const methodLower = route.method.toLowerCase();
  const desc = `${route.method} ${route.path}`;
  const hasBody = ['POST', 'PUT', 'PATCH'].includes(route.method);

  return `
  // TODO: 自动生成 - ${desc}
  it('${desc}', async () => {
    const res = await app.httpRequest()
      .${methodLower}('${route.path}')${route.needsAuth ? "\n      .set('Authorization', `Bearer ${adminToken}`)" : ''}${hasBody ? "\n      .send({ /* TODO: 填写请求体 */ })" : ''};
    assert.ok(res.status < 500, 'should not return 5xx, got ' + res.status);
  });`;
}

/**
 * 同步测试文件：在文件末尾追加未覆盖路由的骨架
 */
function syncTestFile(moduleKey) {
  const mod = MODULES[moduleKey];
  if (!mod || !mod.testFile) {
    log.warn(`模块 ${moduleKey} 没有对应的测试文件配置`);
    return;
  }

  const uncovered = findUncoveredRoutes(moduleKey);
  if (uncovered.length === 0) {
    log.success(`[${mod.label}] 所有接口均已有测试覆盖 ✓`);
    return;
  }

  const testFilePath = path.join(TEST_DIR, mod.testFile);
  if (!fs.existsSync(testFilePath)) {
    log.warn(`测试文件不存在：${mod.testFile}`);
    return;
  }

  let content = fs.readFileSync(testFilePath, 'utf-8');

  // 在最后一个 }); 之前插入骨架
  const skeletons = uncovered.map(generateTestSkeleton).join('\n');
  const insertMarker = '\n  // ── 自动同步的待实现测试 ──';

  // 移除旧的自动同步块（如果存在）
  const autoStart = content.indexOf('\n  // ── 自动同步的待实现测试 ──');
  if (autoStart !== -1) {
    content = content.slice(0, autoStart);
    // 确保末尾有 });
    if (!content.trimEnd().endsWith('});')) {
      content = content.trimEnd() + '\n});\n';
    }
  }

  // 找到最后一个 }); 并在其前插入
  const lastClose = content.lastIndexOf('});');
  if (lastClose === -1) {
    log.error(`无法定位测试文件结构：${mod.testFile}`);
    return;
  }

  const newContent =
    content.slice(0, lastClose) +
    insertMarker + '\n' +
    skeletons + '\n' +
    content.slice(lastClose);

  fs.writeFileSync(testFilePath, newContent, 'utf-8');
  log.success(`[${mod.label}] 已同步 ${uncovered.length} 个未覆盖接口到测试文件`);
  uncovered.forEach(r => log.dim(`  + ${r.method} ${r.path}`));
}

// ─────────────────────────── 文档生成模块 ───────────────────────────

/**
 * 根据路由信息生成请求/响应示例
 */
function buildApiExample(route) {
  const { method, path: routePath, needsAuth } = route;
  const hasBody = ['POST', 'PUT', 'PATCH'].includes(method);

  // 根据路径推断参数和请求体示例
  const pathParams = (routePath.match(/:(\w+)/g) || []).map(p => p.slice(1));
  const examplePath = pathParams.reduce(
    (p, param) => p.replace(`:${param}`, `{${param}}`),
    routePath
  );

  // 推断请求体示例
  let bodyExample = '';
  if (hasBody) {
    if (routePath.includes('/login')) {
      bodyExample = JSON.stringify({ username: 'admin', password: 'Admin@123456', clientId: 'web', clientSecret: 'secret' }, null, 2);
    } else if (routePath.includes('/register')) {
      bodyExample = JSON.stringify({ username: 'newuser', email: 'user@example.com', password: 'Pass@123456', nickname: '新用户', clientId: 'web' }, null, 2);
    } else if (routePath.includes('/refresh')) {
      bodyExample = JSON.stringify({ refreshToken: '<refresh_token>' }, null, 2);
    } else if (routePath.includes('/password')) {
      bodyExample = JSON.stringify({ oldPassword: 'OldPass@123', newPassword: 'NewPass@123' }, null, 2);
    } else if (routePath.includes('/addresses')) {
      bodyExample = JSON.stringify({ receiver: '张三', phone: '13800138000', province: '广东省', city: '深圳市', district: '南山区', address: '科技园路1号' }, null, 2);
    } else if (routePath.includes('/roles') && routePath.includes('/permissions')) {
      bodyExample = JSON.stringify({ permissionIds: [1, 2, 3] }, null, 2);
    } else if (routePath.includes('/roles')) {
      bodyExample = JSON.stringify({ name: '角色名称', code: 'role_code', type: 2, description: '角色描述', status: 1 }, null, 2);
    } else if (routePath.includes('/permissions')) {
      bodyExample = JSON.stringify({ name: '权限名称', code: 'perm:code', type: 1, platform: 'web', sort: 100 }, null, 2);
    } else if (routePath.includes('/bind/phone')) {
      bodyExample = JSON.stringify({ phone: '13800138000', code: '123456' }, null, 2);
    } else if (routePath.includes('/bind/wechat')) {
      bodyExample = JSON.stringify({ platform: 'miniprogram', code: 'wx_auth_code' }, null, 2);
    } else if (routePath.includes('/bind/email')) {
      bodyExample = JSON.stringify({ email: 'user@example.com', code: '123456' }, null, 2);
    } else if (routePath.includes('/unbind')) {
      bodyExample = JSON.stringify({ type: 'phone', platform: 'miniprogram' }, null, 2);
    } else if (routePath.includes('/wechat-login')) {
      bodyExample = JSON.stringify({ code: 'wx_auth_code', platform: 'miniprogram', clientId: 'web', clientSecret: 'secret', userInfo: {} }, null, 2);
    } else if (routePath.includes('/phone-login')) {
      bodyExample = JSON.stringify({ phone: '13800138000', code: '123456', clientId: 'web', clientSecret: 'secret' }, null, 2);
    } else if (routePath.includes('/send-code')) {
      bodyExample = JSON.stringify({ target: '13800138000', type: 'login', platform: 'h5' }, null, 2);
    } else if (routePath.includes('/devices') && routePath.includes('/push')) {
      bodyExample = JSON.stringify({ pushEnabled: true }, null, 2);
    } else if (routePath.includes('/devices')) {
      bodyExample = JSON.stringify({ deviceId: 'device_001', deviceType: 'ios', deviceName: 'iPhone 15', osVersion: 'iOS 18.0', appVersion: '1.0.0', pushToken: 'apns_token' }, null, 2);
    } else if (routePath.includes('/users/profile')) {
      bodyExample = JSON.stringify({ nickname: '新昵称', bio: '个人简介', signature: '个性签名', language: 'zh-CN', timezone: 'Asia/Shanghai' }, null, 2);
    } else if (routePath.includes('/users')) {
      bodyExample = JSON.stringify({ username: 'newuser', email: 'user@example.com', password: 'Pass@123456', nickname: '用户昵称' }, null, 2);
    } else {
      bodyExample = JSON.stringify({ placeholder: '请填写请求体' }, null, 2);
    }
  }

  // 推断响应示例
  let responseExample;
  if (method === 'POST') {
    responseExample = { code: 201, message: '创建成功', data: { id: 1, createdAt: '2026-04-01T00:00:00.000Z' } };
  } else if (method === 'DELETE') {
    responseExample = { code: 200, message: '删除成功', data: null };
  } else if (method === 'PUT' || method === 'PATCH') {
    responseExample = { code: 200, message: '更新成功', data: null };
  } else {
    responseExample = { code: 200, message: 'success', data: {} };
  }

  return { examplePath, pathParams, bodyExample, responseExample };
}

/**
 * 生成单个 API 的 Markdown 文档内容
 */
function generateApiDoc(route) {
  const { method, path: routePath, needsAuth, controller } = route;
  const { examplePath, pathParams, bodyExample, responseExample } = buildApiExample(route);
  const hasBody = ['POST', 'PUT', 'PATCH'].includes(method);

  const lines = [];
  lines.push(`## ${method} ${routePath}`);
  lines.push('');
  lines.push(`**控制器：** \`${controller || '—'}\``);
  lines.push(`**认证：** ${needsAuth ? '✅ 需要 Bearer Token' : '❌ 无需认证'}`);
  lines.push('');

  // 路径参数
  if (pathParams.length > 0) {
    lines.push('### 路径参数');
    lines.push('');
    lines.push('| 参数 | 类型 | 说明 |');
    lines.push('|------|------|------|');
    pathParams.forEach(p => lines.push(`| ${p} | number/string | ${p} |`));
    lines.push('');
  }

  // 请求体
  if (hasBody && bodyExample) {
    lines.push('### 请求体 (application/json)');
    lines.push('');
    lines.push('```json');
    lines.push(bodyExample);
    lines.push('```');
    lines.push('');
  }

  // 前端调用示例
  lines.push('### 前端调用示例');
  lines.push('');
  lines.push('```javascript');
  lines.push('// 使用 fetch');
  if (needsAuth) {
    lines.push("const token = localStorage.getItem('accessToken');");
  }
  lines.push(`const response = await fetch(\`\${BASE_URL}${examplePath}\`, {`);
  lines.push(`  method: '${method}',`);
  lines.push("  headers: {");
  lines.push("    'Content-Type': 'application/json',");
  if (needsAuth) {
    lines.push("    'Authorization': `Bearer ${token}`,");
  }
  lines.push("  },");
  if (hasBody && bodyExample) {
    lines.push(`  body: JSON.stringify(${bodyExample.split('\n')[0] === '{' ? bodyExample : '{ /* 请求体 */ }'}),`);
  }
  lines.push('});');
  lines.push('const data = await response.json();');
  lines.push('```');
  lines.push('');

  // Axios 示例
  lines.push('```javascript');
  lines.push('// 使用 axios');
  const axiosMethod = method.toLowerCase();
  if (hasBody) {
    lines.push(`const { data } = await axios.${axiosMethod}(\`\${BASE_URL}${examplePath}\`, payload, {`);
  } else {
    lines.push(`const { data } = await axios.${axiosMethod}(\`\${BASE_URL}${examplePath}\`, {`);
  }
  if (needsAuth) {
    lines.push("  headers: { Authorization: `Bearer ${token}` },");
  }
  lines.push('});');
  lines.push('```');
  lines.push('');

  // 响应示例
  lines.push('### 响应示例');
  lines.push('');
  lines.push('```json');
  lines.push(JSON.stringify(responseExample, null, 2));
  lines.push('```');
  lines.push('');

  // 错误码说明
  lines.push('### 错误码说明');
  lines.push('');
  lines.push('| HTTP 状态码 | code | 说明 |');
  lines.push('|-------------|------|------|');
  if (needsAuth) {
    lines.push('| 401 | 401 | 未认证或 Token 已失效 |');
  }
  lines.push('| 422 | 422 | 请求参数校验失败 |');
  lines.push('| 404 | 404 | 资源不存在 |');
  lines.push('| 500 | 500 | 服务器内部错误 |');
  lines.push('');
  lines.push('---');
  lines.push('');

  return lines.join('\n');
}

/**
 * 生成模块级 API 文档（汇总所有接口）
 */
function generateModuleDocs(moduleKey) {
  const mod = MODULES[moduleKey];
  if (!mod || !mod.docsDir) {
    log.warn(`模块 ${moduleKey} 没有配置文档目录`);
    return;
  }

  const allRoutes = parseRouter();
  const moduleRoutes = allRoutes.filter(r => r.module === moduleKey);

  if (moduleRoutes.length === 0) {
    log.warn(`模块 ${moduleKey} 没有找到路由`);
    return;
  }

  // 确保目录存在
  const docDir = path.join(DOCS_DIR, mod.docsDir);
  fs.mkdirSync(docDir, { recursive: true });

  // 生成汇总文档
  const lines = [];
  lines.push(`# ${mod.label} API 文档`);
  lines.push('');
  lines.push(`> 自动生成于 ${new Date().toLocaleString('zh-CN')}`);
  lines.push('');
  lines.push('## 接口列表');
  lines.push('');
  lines.push('| 方法 | 路径 | 认证 | 说明 |');
  lines.push('|------|------|------|------|');
  moduleRoutes.forEach(r => {
    lines.push(`| \`${r.method}\` | \`${r.path}\` | ${r.needsAuth ? '✅' : '❌'} | ${r.controller} |`);
  });
  lines.push('');
  lines.push('---');
  lines.push('');

  // 逐个接口详情
  moduleRoutes.forEach(route => {
    lines.push(generateApiDoc(route));
  });

  const docFile = path.join(docDir, 'README.md');
  fs.writeFileSync(docFile, lines.join('\n'), 'utf-8');
  log.success(`[${mod.label}] 文档已生成：docs/api/${mod.docsDir}/README.md（${moduleRoutes.length} 个接口）`);
}

/**
 * 生成全局 API 索引文档
 */
function generateIndexDoc(routes) {
  fs.mkdirSync(DOCS_DIR, { recursive: true });

  const lines = [];
  lines.push('# API 接口总览');
  lines.push('');
  lines.push(`> 自动生成于 ${new Date().toLocaleString('zh-CN')}`);
  lines.push('');
  lines.push(`共 **${routes.length}** 个接口`);
  lines.push('');

  const groups = groupRoutesByModule(routes);
  for (const [key, modRoutes] of Object.entries(groups)) {
    const mod = MODULES[key];
    const label = mod ? mod.label : key;
    const docsLink = mod && mod.docsDir ? `[查看文档](${mod.docsDir}/README.md)` : '';
    lines.push(`## ${label} ${docsLink}`);
    lines.push('');
    lines.push('| 方法 | 路径 | 认证 |');
    lines.push('|------|------|------|');
    modRoutes.forEach(r => {
      lines.push(`| \`${r.method}\` | \`${r.path}\` | ${r.needsAuth ? '✅' : '❌'} |`);
    });
    lines.push('');
  }

  fs.writeFileSync(path.join(DOCS_DIR, 'README.md'), lines.join('\n'), 'utf-8');
  log.success(`全局 API 索引已生成：docs/api/README.md`);
}

// ─────────────────────────── 测试运行模块 ───────────────────────────

/**
 * 运行指定模块的测试（Promise 版，await 等待完成）
 */
function runTestsAsync(moduleKey) {
  const mod = MODULES[moduleKey];
  if (!mod) {
    log.error(`未知模块：${moduleKey}`);
    return Promise.resolve();
  }

  const testFile = path.join(TEST_DIR, mod.testFile);
  if (!fs.existsSync(testFile)) {
    log.error(`测试文件不存在：${mod.testFile}`);
    return Promise.resolve();
  }

  log.section(`运行测试：${mod.label}`);
  log.dim(`文件：test/${mod.testFile}`);
  log.blank();

  const cmd = process.platform === 'win32' ? 'npx.cmd' : 'npx';
  const args = [
    'cross-env', 'EGG_SERVER_ENV=unittest',
    'egg-bin', 'test', '--ts',
    testFile,
  ];

  return new Promise(resolve => {
    const child = spawn(cmd, args, {
      cwd: ROOT,
      stdio: 'inherit',
      shell: true,
    });
    child.on('close', (code) => {
      log.blank();
      if (code === 0) {
        log.success('测试通过 ✓');
      } else {
        log.error(`测试失败，退出码：${code}`);
      }
      resolve();
    });
  });
}

/**
 * 运行所有测试（Promise 版）
 */
function runAllTestsAsync() {
  log.section('运行全部测试');
  log.blank();

  return new Promise(resolve => {
    const child = spawn(
      process.platform === 'win32' ? 'npm.cmd' : 'npm',
      ['test'],
      { cwd: ROOT, stdio: 'inherit', shell: true }
    );
    child.on('close', (code) => {
      log.blank();
      if (code === 0) {
        log.success('全部测试通过 ✓');
      } else {
        log.error(`测试失败，退出码：${code}`);
      }
      resolve();
    });
  });
}

// ─────────────────────────── 接口扫描展示 ───────────────────────────

function showRoutesSummary() {
  const routes = parseRouter();
  const groups = groupRoutesByModule(routes);

  log.section('当前 API 接口扫描结果');
  log.blank();

  for (const [key, modRoutes] of Object.entries(groups)) {
    const mod = MODULES[key];
    const label = mod ? mod.label : key;
    console.log(`${c.bold}${c.cyan}${label}${c.reset}  ${c.dim}(${modRoutes.length} 个接口)${c.reset}`);
    modRoutes.forEach(r => {
      const authTag = r.needsAuth ? `${c.green}[auth]${c.reset}` : `${c.dim}[open]${c.reset}`;
      const methodColor = {
        GET: c.green, POST: c.blue, PUT: c.yellow,
        DELETE: c.red, PATCH: c.magenta,
      }[r.method] || c.white;
      console.log(`  ${methodColor}${r.method.padEnd(7)}${c.reset} ${r.path.padEnd(45)} ${authTag}`);
    });
    log.blank();
  }

  log.dim(`共 ${routes.length} 个接口`);
}

// ─────────────────────────── 覆盖率检查 ───────────────────────────

function showCoverageReport() {
  log.section('测试覆盖率检查');
  log.blank();

  const allRoutes = parseRouter();
  let totalRoutes = 0;
  let coveredRoutes = 0;

  for (const [key, mod] of Object.entries(MODULES)) {
    if (!mod.testFile || !mod.routePrefix) continue;
    const moduleRoutes = allRoutes.filter(r => r.module === key);
    const covered = getTestedRoutes(mod.testFile);
    const uncovered = moduleRoutes.filter(r => !covered.has(`${r.method} ${r.path}`));

    totalRoutes += moduleRoutes.length;
    coveredRoutes += moduleRoutes.length - uncovered.length;

    const pct = moduleRoutes.length > 0
      ? Math.round(((moduleRoutes.length - uncovered.length) / moduleRoutes.length) * 100)
      : 100;
    const bar = buildProgressBar(pct);
    const color = pct === 100 ? c.green : pct >= 70 ? c.yellow : c.red;

    console.log(`${c.bold}${mod.label}${c.reset}`);
    console.log(`  ${bar} ${color}${pct}%${c.reset}  (${moduleRoutes.length - uncovered.length}/${moduleRoutes.length})`);
    if (uncovered.length > 0) {
      uncovered.forEach(r => log.dim(`    ✗ ${r.method} ${r.path}`));
    }
    log.blank();
  }

  const totalPct = totalRoutes > 0 ? Math.round((coveredRoutes / totalRoutes) * 100) : 100;
  console.log(`${c.bold}总体覆盖率：${c.reset}${buildProgressBar(totalPct)} ${totalPct}%  (${coveredRoutes}/${totalRoutes})`);
  log.blank();
}

function buildProgressBar(pct, width = 20) {
  const filled = Math.round((pct / 100) * width);
  const empty = width - filled;
  const color = pct === 100 ? c.green : pct >= 70 ? c.yellow : c.red;
  return `${color}${'█'.repeat(filled)}${c.dim}${'░'.repeat(empty)}${c.reset}`;
}

// ─────────────────────────── 文件监控 ───────────────────────────

let watchTimers = {};

function startWatchMode() {
  log.title('文件监控模式已启动');
  log.info('监控目录：app/controller, app/router.ts');
  log.info('按 Ctrl+C 退出');
  log.blank();

  const watchTargets = [
    ROUTER_FILE,
    CTRL_DIR,
  ];

  const onChange = (eventType, filename) => {
    if (!filename) return;
    const key = filename;
    if (watchTimers[key]) clearTimeout(watchTimers[key]);
    watchTimers[key] = setTimeout(() => {
      log.warn(`检测到文件变化：${filename}`);
      log.info('重新扫描接口并更新文档...');
      try {
        const routes = parseRouter();
        generateIndexDoc(routes);
        // 更新所有模块文档
        for (const key of Object.keys(MODULES)) {
          if (MODULES[key].docsDir) generateModuleDocs(key);
        }
        log.success('文档已自动更新');
      } catch (e) {
        log.error('更新失败：' + e.message);
      }
    }, 300);
  };

  watchTargets.forEach(target => {
    if (fs.existsSync(target)) {
      fs.watch(target, { recursive: true }, onChange);
    }
  });
}

// ─────────────────────────── 交互式菜单 ───────────────────────────

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

// 面包屑导航栈
const breadcrumb = [];

/** 渲染面包屑 */
function renderBreadcrumb() {
  if (breadcrumb.length === 0) return;
  const trail = ['主菜单', ...breadcrumb].join(` ${c.dim}›${c.reset} `);
  console.log(`${c.dim}位置：${c.reset}${trail}`);
}

/**
 * 统一输入函数
 * - 返回用户输入的字符串（已 trim + toLowerCase）
 * - 若用户输入 q/quit/exit → 直接退出程序
 * - 若用户输入 b/back/0   → 抛出特殊 Error('BACK') 供调用方捕获
 */
function ask(question) {
  return new Promise((resolve, reject) => {
    rl.question(`${question} ${c.dim}(b=返回 q=退出)${c.reset} `, (raw) => {
      const val = (raw || '').trim().toLowerCase();
      if (val === 'q' || val === 'quit' || val === 'exit') {
        log.info('再见！');
        rl.close();
        process.exit(0);
      }
      if (val === 'b' || val === 'back' || val === '0') {
        reject(new Error('BACK'));
        return;
      }
      resolve(val);
    });
  });
}

/** 等待用户按回车继续 */
function pressEnterToContinue() {
  return new Promise(resolve => {
    rl.question(`\n${c.dim}按 Enter 继续...${c.reset}`, () => resolve());
  });
}

async function showModuleMenu() {
  breadcrumb.length = 0;
  breadcrumb.push('选择模块');

  while (true) {
    log.section('选择操作模块');
    renderBreadcrumb();
    log.blank();

    const keys = Object.keys(MODULES);
    keys.forEach((key, i) => {
      console.log(`  ${c.cyan}${i + 1}${c.reset}. ${MODULES[key].label}`);
    });
    log.blank();

    let input;
    try {
      input = await ask(`${c.bold}请输入编号`);
    } catch (e) {
      if (e.message === 'BACK') return; // 返回主菜单
      throw e;
    }

    const idx = parseInt(input, 10);
    if (isNaN(idx) || idx < 1 || idx > keys.length) {
      log.error('无效选项，请重新输入');
      continue;
    }

    const moduleKey = keys[idx - 1];
    await showModuleActionMenu(moduleKey);
    // 从模块操作返回后，继续显示模块选择菜单
  }
}

async function showModuleActionMenu(moduleKey) {
  const mod = MODULES[moduleKey];

  // 更新面包屑
  breadcrumb.length = 1; // 保留「选择模块」
  breadcrumb.push(mod.label);

  while (true) {
    log.section(`${mod.label} - 选择操作`);
    renderBreadcrumb();
    log.blank();

    console.log(`  ${c.cyan}1${c.reset}. 运行测试`);
    console.log(`  ${c.cyan}2${c.reset}. 生成/更新 API 文档`);
    console.log(`  ${c.cyan}3${c.reset}. 同步测试文件（追加未覆盖接口骨架）`);
    console.log(`  ${c.cyan}4${c.reset}. 查看接口列表`);
    console.log(`  ${c.cyan}5${c.reset}. 全部执行（测试 + 文档 + 同步）`);
    log.blank();

    let input;
    try {
      input = await ask(`${c.bold}请输入编号`);
    } catch (e) {
      if (e.message === 'BACK') return; // 返回模块选择
      throw e;
    }

    switch (input) {
      case '1':
        // 测试是异步子进程，完成后会自动回到此循环
        await runTestsAsync(moduleKey);
        await pressEnterToContinue();
        break;
      case '2':
        generateModuleDocs(moduleKey);
        await pressEnterToContinue();
        break;
      case '3':
        syncTestFile(moduleKey);
        await pressEnterToContinue();
        break;
      case '4': {
        const routes = parseRouter().filter(r => r.module === moduleKey);
        log.blank();
        if (routes.length === 0) {
          log.warn('该模块暂无路由');
        } else {
          routes.forEach(r => {
            const authTag = r.needsAuth ? `${c.green}[auth]${c.reset}` : `${c.dim}[open]${c.reset}`;
            const methodColor = { GET: c.green, POST: c.blue, PUT: c.yellow, DELETE: c.red, PATCH: c.magenta }[r.method] || c.white;
            console.log(`  ${methodColor}${r.method.padEnd(7)}${c.reset} ${r.path.padEnd(45)} ${authTag}`);
          });
        }
        await pressEnterToContinue();
        break;
      }
      case '5':
        generateModuleDocs(moduleKey);
        syncTestFile(moduleKey);
        await runTestsAsync(moduleKey);
        await pressEnterToContinue();
        break;
      default:
        log.error('无效选项，请重新输入');
    }
  }
}

async function showMainMenu() {
  // 主菜单循环
  while (true) {
    breadcrumb.length = 0; // 回到顶层，清空面包屑

    log.title('Super Tool Node - API 测试交互系统');
    console.log(`  ${c.cyan}1${c.reset}. 按模块操作（测试 / 文档 / 同步）`);
    console.log(`  ${c.cyan}2${c.reset}. 运行全部测试`);
    console.log(`  ${c.cyan}3${c.reset}. 生成全部模块 API 文档`);
    console.log(`  ${c.cyan}4${c.reset}. 同步全部模块测试文件`);
    console.log(`  ${c.cyan}5${c.reset}. 查看接口扫描结果`);
    console.log(`  ${c.cyan}6${c.reset}. 查看测试覆盖率报告`);
    console.log(`  ${c.cyan}7${c.reset}. 启动文件监控模式`);
    console.log(`  ${c.cyan}q${c.reset}. 退出`);
    log.blank();

    let input;
    try {
      // 主菜单的 b/back 也视为退出
      input = await ask(`${c.bold}请输入选项`);
    } catch (e) {
      if (e.message === 'BACK') {
        log.info('已在主菜单，输入 q 退出');
        continue;
      }
      throw e;
    }

    switch (input) {
      case '1':
        await showModuleMenu();
        break;
      case '2':
        await runAllTestsAsync();
        await pressEnterToContinue();
        break;
      case '3':
        for (const key of Object.keys(MODULES)) {
          if (MODULES[key].docsDir) generateModuleDocs(key);
        }
        generateIndexDoc(parseRouter());
        await pressEnterToContinue();
        break;
      case '4':
        for (const key of Object.keys(MODULES)) {
          syncTestFile(key);
        }
        await pressEnterToContinue();
        break;
      case '5':
        showRoutesSummary();
        await pressEnterToContinue();
        break;
      case '6':
        showCoverageReport();
        await pressEnterToContinue();
        break;
      case '7':
        startWatchMode();
        // watch 模式不返回，进程持续运行
        return;
      default:
        log.error('无效选项，请重新输入');
    }
  }
}

// ─────────────────────────── CLI 参数处理 ───────────────────────────

async function main() {
  const args = process.argv.slice(2);

  if (args.includes('--watch')) {
    startWatchMode();
    return;
  }

  if (args.includes('--all-docs')) {
    log.title('生成全部 API 文档');
    for (const key of Object.keys(MODULES)) {
      if (MODULES[key].docsDir) generateModuleDocs(key);
    }
    generateIndexDoc(parseRouter());
    rl.close();
    return;
  }

  if (args.includes('--all-test')) {
    log.title('运行全部测试');
    await runAllTestsAsync();
    rl.close();
    return;
  }

  if (args.includes('--sync')) {
    log.title('同步全部测试文件');
    for (const key of Object.keys(MODULES)) {
      syncTestFile(key);
    }
    rl.close();
    return;
  }

  if (args.includes('--coverage')) {
    showCoverageReport();
    rl.close();
    return;
  }

  if (args.includes('--scan')) {
    showRoutesSummary();
    rl.close();
    return;
  }

  // 默认：交互式菜单
  await showMainMenu();
}

main().catch(err => {
  log.error('运行出错：' + err.message);
  process.exit(1);
});
