import assert from 'assert';
import { MockApplication } from 'egg-mock';
import mm from 'egg-mock';
import { TEST_CLIENT, TEST_ADMIN, assertSuccess } from '../helpers/setup';

/**
 * RBAC 中间件 (checkPermission) 集成测试
 *
 * 覆盖路由权限化（P2-B）后的三大行为分支：
 *   1. super_admin（userType=3）—— 中间件第 15 行短路，应一律放行
 *   2. 未登录 —— 401
 *   3. 普通用户（userType=1，无管理端角色）—— 403 权限不足
 *
 * 不覆盖：
 *   - admin/operator/auditor 角色精细矩阵（需要造用户 + 角色绑定，留给后续 RBAC 矩阵专项测）
 *   - 缓存命中分支（PermissionService.getUserPermissionCodes 内部实现细节）
 */
describe('RBAC checkPermission middleware', () => {
  let app: MockApplication;
  let superAdminToken = '';
  let normalUserToken = '';
  const ts = Date.now();
  const NORMAL_USER = {
    username: `rbac_user_${ts}`,
    email: `rbac_user_${ts}@example.com`,
    password: 'Test@123456',
    nickname: 'RBAC普通用户',
  };

  before(async () => {
    app = mm.app({ baseDir: process.cwd() });
    await app.ready();

    // 1) super_admin 登录（沿用 admin 账号）
    const loginRes = await app.httpRequest()
      .post('/api/auth/login')
      .send({
        username: TEST_ADMIN.username,
        password: TEST_ADMIN.password,
        clientId: TEST_CLIENT.clientId,
        clientSecret: TEST_CLIENT.clientSecret,
      });
    superAdminToken = loginRes.body.data && loginRes.body.data.accessToken;
    if (!superAdminToken) {
      throw new Error('super_admin 登录失败: ' + JSON.stringify(loginRes.body));
    }

    // 2) 注册一个普通用户（userType=1，仅绑定 user 系统角色，无任何管理端权限）
    const regRes = await app.httpRequest()
      .post('/api/auth/register')
      .send({
        username: NORMAL_USER.username,
        email: NORMAL_USER.email,
        password: NORMAL_USER.password,
        nickname: NORMAL_USER.nickname,
        clientId: TEST_CLIENT.clientId,
      });
    if (regRes.status !== 201) {
      throw new Error('普通用户注册失败: ' + JSON.stringify(regRes.body));
    }

    // 3) 普通用户登录拿 token
    const userLogin = await app.httpRequest()
      .post('/api/auth/login')
      .send({
        username: NORMAL_USER.username,
        password: NORMAL_USER.password,
        clientId: TEST_CLIENT.clientId,
        clientSecret: TEST_CLIENT.clientSecret,
      });
    normalUserToken = userLogin.body.data && userLogin.body.data.accessToken;
    if (!normalUserToken) {
      throw new Error('普通用户登录失败: ' + JSON.stringify(userLogin.body));
    }
  });

  after(async () => {
    await app.close();
    mm.restore();
  });

  // ==================== 分支 1：super_admin 短路放行 ====================

  describe('super_admin (userType=3) bypass', () => {
    it('GET /api/admin/tools — super_admin 应放行 (200)', async () => {
      const res = await app.httpRequest()
        .get('/api/admin/tools')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(200);
      assertSuccess(res.body);
    });

    it('GET /api/admin/roles — super_admin 应放行 (200)', async () => {
      const res = await app.httpRequest()
        .get('/api/admin/roles')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(200);
      assertSuccess(res.body);
    });

    it('GET /api/admin/permissions/tree — super_admin 应放行 (200)', async () => {
      const res = await app.httpRequest()
        .get('/api/admin/permissions/tree')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(200);
      assertSuccess(res.body);
    });

    it('GET /api/admin/dashboard — super_admin 应放行 (2xx)', async () => {
      const res = await app.httpRequest()
        .get('/api/admin/dashboard')
        .set('Authorization', `Bearer ${superAdminToken}`);
      assert.ok(res.status >= 200 && res.status < 300, 'super_admin 应放行，实际 ' + res.status);
    });

    it('GET /api/admin/tool-categories — super_admin 应放行 (2xx)', async () => {
      const res = await app.httpRequest()
        .get('/api/admin/tool-categories')
        .set('Authorization', `Bearer ${superAdminToken}`);
      assert.ok(res.status >= 200 && res.status < 300, 'super_admin 应放行，实际 ' + res.status);
    });
  });

  // ==================== 分支 2：未登录 401 ====================

  describe('unauthenticated requests return 401', () => {
    it('GET /api/admin/tools without token returns 401', async () => {
      const res = await app.httpRequest()
        .get('/api/admin/tools')
        .expect(401);
      assert.ok(res.body);
    });

    it('GET /api/admin/roles without token returns 401', async () => {
      await app.httpRequest()
        .get('/api/admin/roles')
        .expect(401);
    });

    it('POST /api/admin/permissions without token returns 401', async () => {
      await app.httpRequest()
        .post('/api/admin/permissions')
        .send({ name: 'x', code: 'x:y' })
        .expect(401);
    });

    it('GET /api/admin/dashboard without token returns 401', async () => {
      await app.httpRequest()
        .get('/api/admin/dashboard')
        .expect(401);
    });

    it('invalid token returns 401', async () => {
      await app.httpRequest()
        .get('/api/admin/tools')
        .set('Authorization', 'Bearer this.is.not.a.valid.token')
        .expect(401);
    });
  });

  // ==================== 分支 3：普通用户 403 ====================

  describe('normal user (userType=1) without admin permissions returns 403', () => {
    it('GET /api/admin/tools — 普通用户应被拒 (403)', async () => {
      const res = await app.httpRequest()
        .get('/api/admin/tools')
        .set('Authorization', `Bearer ${normalUserToken}`);
      assert.strictEqual(res.status, 403, '应返回 403，实际 ' + res.status + ' body=' + JSON.stringify(res.body));
    });

    it('GET /api/admin/roles — 普通用户应被拒 (403)', async () => {
      const res = await app.httpRequest()
        .get('/api/admin/roles')
        .set('Authorization', `Bearer ${normalUserToken}`);
      assert.strictEqual(res.status, 403);
    });

    it('GET /api/admin/permissions/tree — 普通用户应被拒 (403)', async () => {
      const res = await app.httpRequest()
        .get('/api/admin/permissions/tree')
        .set('Authorization', `Bearer ${normalUserToken}`);
      assert.strictEqual(res.status, 403);
    });

    it('POST /api/admin/tools — 普通用户应被拒 (403)', async () => {
      const res = await app.httpRequest()
        .post('/api/admin/tools')
        .set('Authorization', `Bearer ${normalUserToken}`)
        .send({ name: 'x', code: 'x', categoryId: 1 });
      assert.strictEqual(res.status, 403);
    });

    it('GET /api/admin/dashboard — 普通用户应被拒 (403)', async () => {
      const res = await app.httpRequest()
        .get('/api/admin/dashboard')
        .set('Authorization', `Bearer ${normalUserToken}`);
      assert.strictEqual(res.status, 403);
    });

    it('GET /api/admin/tool-categories — 普通用户应被拒 (403)', async () => {
      const res = await app.httpRequest()
        .get('/api/admin/tool-categories')
        .set('Authorization', `Bearer ${normalUserToken}`);
      assert.strictEqual(res.status, 403);
    });

    // 反向用例：普通用户访问"自己的资源"路径不应被中间件拦截
    it('GET /api/auth/me — 普通用户访问自己的资源应放行 (200)', async () => {
      const res = await app.httpRequest()
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${normalUserToken}`)
        .expect(200);
      assertSuccess(res.body);
      assert.strictEqual(res.body.data.isSuperAdmin, false, '普通用户 isSuperAdmin 应为 false');
      assert.deepStrictEqual(res.body.data.permissions, [], '普通用户应无任何显式权限码');
    });
  });

  // ==================== /api/auth/me 上下文契约 ====================

  describe('GET /api/auth/me — 权限上下文契约', () => {
    it('super_admin 返回 isSuperAdmin=true', async () => {
      const res = await app.httpRequest()
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(200);
      assertSuccess(res.body);
      assert.strictEqual(res.body.data.isSuperAdmin, true);
      assert.ok(Array.isArray(res.body.data.roles), 'roles 应为数组');
      assert.ok(Array.isArray(res.body.data.permissions), 'permissions 应为数组');
    });
  });
});
