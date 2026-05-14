import * as assert from 'assert';
import { app } from 'egg-mock/bootstrap';

describe('工具模块 (Tool) H5 API', () => {
  let adminToken: string;

  before(async () => {
    // 登录获取 admin token（admin 默认已有 UserMember 记录；复用 admin 来覆盖 checkAccess）
    const res = await app.httpRequest().post('/api/auth/login').send({
      username: 'admin',
      password: 'Admin@123456',
      clientId: 'admin_client',
      clientSecret: 'ADMIN_SECRET',
    });
    adminToken = res.body.data?.accessToken;
    assert.ok(adminToken, '获取 admin token 失败');
  });

  // ==================== GET /api/tools/home ====================

  describe('GET /api/tools/home — 首页聚合/分页', () => {
    it('无参数 → 聚合模式，返回 11 个分类 + 233 工具', async () => {
      const res = await app.httpRequest().get('/api/tools/home');
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.code, 200);
      assert.strictEqual(res.body.data.mode, 'aggregate');
      assert.ok(Array.isArray(res.body.data.categories));
      assert.strictEqual(res.body.data.categories.length, 11);

      // 统计全部 tools
      const totalTools = res.body.data.categories.reduce(
        (s: number, c: any) => s + (c.tools?.length || 0),
        0,
      );
      assert.strictEqual(totalTools, 233, `期望 233 个工具，实际 ${totalTools}`);
    });

    it('categoryCode=DAILY → 分页模式，total=16', async () => {
      const res = await app.httpRequest()
        .get('/api/tools/home?categoryCode=DAILY&page=1&pageSize=20');
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.data.mode, 'paginated');
      assert.strictEqual(res.body.data.tools.total, 16);
      assert.ok(Array.isArray(res.body.data.tools.list));
      assert.ok(res.body.data.tools.list.length <= 16);
      // 分类列表也应同时下发
      assert.ok(Array.isArray(res.body.data.categories));
      assert.ok(res.body.data.categories.length >= 11);
    });

    it('keyword=黄金 → 分页模式，命中 gold-price', async () => {
      const res = await app.httpRequest()
        .get('/api/tools/home?keyword=' + encodeURIComponent('黄金'));
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.data.mode, 'paginated');
      assert.ok(res.body.data.tools.total >= 1);
      const codes = res.body.data.tools.list.map((t: any) => t.code);
      assert.ok(codes.includes('gold-price'), `期望包含 gold-price，实际 ${codes}`);
    });

    it('不存在的 categoryCode → 空列表（不报错）', async () => {
      const res = await app.httpRequest()
        .get('/api/tools/home?categoryCode=NOT_EXIST');
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.data.mode, 'paginated');
      assert.strictEqual(res.body.data.tools.total, 0);
      assert.deepStrictEqual(res.body.data.tools.list, []);
    });

    it('聚合模式工具字段包含 isFeature/requiredLevelCode/requirePaid', async () => {
      const res = await app.httpRequest().get('/api/tools/home');
      const firstTool = res.body.data.categories[0].tools[0];
      assert.ok(firstTool, '应该有工具数据');
      assert.strictEqual(typeof firstTool.isFeature, 'number');
      assert.strictEqual(typeof firstTool.requiredLevelCode, 'string');
      assert.strictEqual(typeof firstTool.requirePaid, 'number');
      // 种子数据默认值
      assert.strictEqual(firstTool.isFeature, 0);
      assert.strictEqual(firstTool.requiredLevelCode, 'free');
      assert.strictEqual(firstTool.requirePaid, 0);
    });
  });

  // ==================== GET /api/tools/feature ====================

  describe('GET /api/tools/feature — 特色 Tab', () => {
    it('种子数据 is_feature=0，返回空列表', async () => {
      const res = await app.httpRequest().get('/api/tools/feature');
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.data.total, 0);
      assert.deepStrictEqual(res.body.data.list, []);
    });

    it('支持分页参数', async () => {
      const res = await app.httpRequest()
        .get('/api/tools/feature?page=1&pageSize=10');
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.data.page, 1);
      assert.strictEqual(res.body.data.pageSize, 10);
    });
  });

  // ==================== GET /api/tools/member ====================

  describe('GET /api/tools/member — 会员专属 Tab', () => {
    it('种子数据 required_level=free && require_paid=0，返回空列表', async () => {
      const res = await app.httpRequest().get('/api/tools/member');
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.data.total, 0);
    });
  });

  // ==================== GET /api/tools/:code/access ====================

  describe('GET /api/tools/:code/access — 使用前权限校验', () => {
    it('未登录应返回 401', async () => {
      const res = await app.httpRequest().get('/api/tools/gold-price/access');
      assert.strictEqual(res.status, 401);
    });

    it('不存在的工具 → 404', async () => {
      const res = await app.httpRequest()
        .get('/api/tools/__non_existent_tool__/access')
        .set('Authorization', `Bearer ${adminToken}`);
      assert.strictEqual(res.status, 404);
    });

    it('免费工具 + 已登录用户 → allowed=true', async () => {
      // gold-price 是 required_level_code='free', require_paid=0 的种子工具
      const res = await app.httpRequest()
        .get('/api/tools/gold-price/access')
        .set('Authorization', `Bearer ${adminToken}`);
      // admin 用户可能没有 UserMember 记录；但免费工具走快速通道，不查 UserMember
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.data.allowed, true);
      assert.ok(res.body.data.tool);
      assert.strictEqual(res.body.data.tool.code, 'gold-price');
      assert.strictEqual(res.body.data.tool.path, '/gold-price');
    });
  });
});
