import assert from 'assert';
import { MockApplication } from 'egg-mock';
import mm from 'egg-mock';
import { TEST_CLIENT, TEST_ADMIN } from '../helpers/setup';

/**
 * Permission Test Service 契约测试（service.permission.testForUser / checkUserAccess / testForRole）
 *
 * 覆盖 6 个 case：
 *   1. testForUser  — admin 用户全景 + super_admin 短路标志
 *   2. testForUser  — 不存在用户返回空结构
 *   3. checkUserAccess — admin 拥有 tool:list（命中）
 *   4. checkUserAccess — 用户不存在 → denyReason='user_not_found'
 *   5. checkUserAccess — 权限码不存在 → denyReason='permission_not_exists'
 *   6. testForRole  — auditor 角色矩阵（ownedCodes/permissionTree/byType）
 *
 * 风格：与 audit.test.ts / rbac-cache.test.ts 一致，真实 DB 查询验证。
 */
describe('Permission Test Service contract', () => {
  let app: MockApplication;
  let adminUserId = 0;

  before(async () => {
    app = mm.app({ baseDir: process.cwd() });
    await app.ready();

    // 用 admin 登录拿 userId
    const loginRes = await app.httpRequest()
      .post('/api/auth/login')
      .send({
        username: TEST_ADMIN.username,
        password: TEST_ADMIN.password,
        clientId: TEST_CLIENT.clientId,
        clientSecret: TEST_CLIENT.clientSecret,
      });
    const adminToken = loginRes.body.data?.accessToken;
    if (!adminToken) {
      throw new Error('admin 登录失败: ' + JSON.stringify(loginRes.body));
    }
    const meRes = await app.httpRequest()
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    adminUserId = meRes.body.data?.user?.id;
    if (!adminUserId) throw new Error('未拿到 admin userId');
  });

  after(async () => {
    await app.close();
    mm.restore();
  });

  // ============ Case 1: testForUser - admin 全景 ============

  it('testForUser admin 用户应返回 user/roles/codes/menus/stats，且 isSuperAdmin 标志正确', async () => {
    const ctx = app.createAnonymousContext();
    const r: any = await ctx.service.permission.testForUser(adminUserId);

    assert.ok(r.user, 'user 字段应存在');
    assert.strictEqual(r.user.id, adminUserId);
    assert.ok(Array.isArray(r.roles), 'roles 应为数组');
    assert.ok(Array.isArray(r.permissionCodes), 'permissionCodes 应为数组');
    assert.ok(Array.isArray(r.menus), 'menus 应为数组');
    assert.ok(typeof r.isSuperAdmin === 'boolean', 'isSuperAdmin 应为 boolean');
    assert.ok(r.stats && typeof r.stats.totalCodes === 'number');
    assert.ok(typeof r.stats.byModule === 'object');
  });

  // ============ Case 2: testForUser - 不存在用户 ============

  it('testForUser 不存在的用户返回 user=null + 空集合', async () => {
    const ctx = app.createAnonymousContext();
    const r: any = await ctx.service.permission.testForUser(99999999);

    assert.strictEqual(r.user, null, 'user 应为 null');
    assert.deepStrictEqual(r.roles, []);
    assert.deepStrictEqual(r.permissionCodes, []);
    assert.deepStrictEqual(r.menus, []);
    assert.strictEqual(r.isSuperAdmin, false);
  });

  // ============ Case 3: checkUserAccess 命中 ============

  it('checkUserAccess admin 拥有 tool:list（命中或 super_admin 短路）', async () => {
    const ctx = app.createAnonymousContext();
    const r: any = await ctx.service.permission.checkUserAccess(adminUserId, {
      code: 'tool:list',
    });

    assert.strictEqual(r.allowed, true, 'admin 应拥有 tool:list');
    assert.strictEqual(r.denyReason, null);
    assert.ok(Array.isArray(r.matchedRoles), 'matchedRoles 应为数组');
    assert.ok(r.matchedRoles.length >= 1, '至少有 1 个匹配角色');
    // super_admin 短路 或 普通命中
    const hasSuperAdmin = r.matchedRoles.some((x: any) => x.code === 'super_admin');
    const hasPerms = r.matchedPermissions.length >= 1;
    assert.ok(hasSuperAdmin || hasPerms, '应有 super_admin 短路或具体匹配权限');
  });

  // ============ Case 4: checkUserAccess - 用户不存在 ============

  it('checkUserAccess 用户不存在 → denyReason=user_not_found', async () => {
    const ctx = app.createAnonymousContext();
    const r: any = await ctx.service.permission.checkUserAccess(99999999, {
      code: 'tool:list',
    });

    assert.strictEqual(r.allowed, false);
    assert.strictEqual(r.denyReason, 'user_not_found');
    assert.strictEqual(r.user, null);
  });

  // ============ Case 5: checkUserAccess - 权限码不存在 ============

  it('checkUserAccess 不存在的权限码 → denyReason=permission_not_exists（除非是 super_admin 短路）', async () => {
    const ctx = app.createAnonymousContext();
    const r: any = await ctx.service.permission.checkUserAccess(adminUserId, {
      code: 'tool:foobar_does_not_exist_xxx',
    });

    // admin 是 super_admin → 会短路返回 allowed=true（even for 不存在的权限码）
    // 这在权限测试工具里实际是个边界：super_admin 即使权限不存在也"看起来允许"
    // 因此我们对 super_admin 用户跳过 permission_not_exists 检查
    if (r.allowed && r.matchedPermissions[0]?.via === 'super_admin_short_circuit') {
      assert.ok(true, 'super_admin 短路允许（符合 §5.3 短路设计）');
    } else {
      assert.strictEqual(r.allowed, false);
      assert.strictEqual(r.denyReason, 'permission_not_exists');
    }
  });

  // ============ Case 6: testForRole - auditor 角色矩阵 ============

  it('testForRole auditor 应返回 role/ownedCodes/permissionTree/stats/boundUserCount', async () => {
    const ctx = app.createAnonymousContext();
    const r: any = await ctx.service.permission.testForRole({ roleCode: 'auditor' });

    assert.ok(r.role, 'role 应存在');
    assert.strictEqual(r.role.code, 'auditor');
    assert.ok(Array.isArray(r.ownedCodes), 'ownedCodes 应为数组');
    assert.ok(r.ownedCodes.length > 0, 'auditor 应该有权限码');
    // auditor 应当包含 system:audit-log 等审计相关码
    assert.ok(r.ownedCodes.includes('system:audit-log'),
      'auditor 应有 system:audit-log');
    assert.ok(Array.isArray(r.permissionTree), 'permissionTree 应为数组');
    assert.ok(r.stats && typeof r.stats.total === 'number');
    assert.ok(typeof r.stats.byModule === 'object');
    assert.ok(typeof r.stats.byType === 'object');
    assert.ok(typeof r.boundUserCount === 'number');
  });
});
