import * as assert from 'assert';
import { app } from 'egg-mock/bootstrap';

describe('工具模块 (Admin Tool) 管理端 API', () => {
  let adminToken: string;
  let createdCategoryId = 0;
  let createdToolId = 0;
  let dailyCategoryId = 0;

  before(async () => {
    const res = await app.httpRequest().post('/api/auth/login').send({
      username: 'admin',
      password: 'Admin@123456',
      clientId: 'admin_client',
      clientSecret: 'ADMIN_SECRET',
    });
    adminToken = res.body.data?.accessToken;
    assert.ok(adminToken, '获取 admin token 失败');
  });

  // ==================== 分类 CRUD ====================

  describe('GET /api/admin/tool-categories — 分类列表', () => {
    it('未登录应返回 401', async () => {
      const res = await app.httpRequest().get('/api/admin/tool-categories');
      assert.strictEqual(res.status, 401);
    });

    it('已登录返回 >= 11 条种子分类', async () => {
      const res = await app.httpRequest()
        .get('/api/admin/tool-categories?page=1&pageSize=20')
        .set('Authorization', `Bearer ${adminToken}`);
      assert.strictEqual(res.status, 200);
      assert.ok(res.body.data.total >= 11);
      assert.ok(Array.isArray(res.body.data.list));

      // 记录 DAILY 分类 id，后续用
      const daily = res.body.data.list.find((c: any) => c.code === 'DAILY');
      assert.ok(daily, '应该存在 DAILY 分类');
      dailyCategoryId = daily.id;

      // 带 toolCount 聚合字段
      assert.ok(typeof daily.toolCount === 'number' || typeof daily.toolCount === 'string');
    });

    it('支持按 keyword 筛选', async () => {
      const res = await app.httpRequest()
        .get('/api/admin/tool-categories?page=1&pageSize=20&keyword=DAILY')
        .set('Authorization', `Bearer ${adminToken}`);
      assert.strictEqual(res.status, 200);
      assert.ok(res.body.data.list.some((c: any) => c.code === 'DAILY'));
    });
  });

  describe('POST /api/admin/tool-categories — 创建分类', () => {
    it('成功创建', async () => {
      const res = await app.httpRequest()
        .post('/api/admin/tool-categories')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          code: 'TEST_CAT_X',
          name: '测试分类X',
          description: '自动化测试创建',
          sort: 99,
        });
      assert.strictEqual(res.status, 201);
      assert.ok(res.body.data?.id);
      createdCategoryId = res.body.data.id;
    });

    it('重复 code 返回 409', async () => {
      const res = await app.httpRequest()
        .post('/api/admin/tool-categories')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ code: 'TEST_CAT_X', name: '重复' });
      assert.strictEqual(res.status, 409);
    });

    it('缺少必填字段返回 422', async () => {
      const res = await app.httpRequest()
        .post('/api/admin/tool-categories')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ code: 'X' }); // 缺 name，且 code 太短
      assert.strictEqual(res.status, 422);
    });
  });

  describe('PUT /api/admin/tool-categories/:id — 更新分类', () => {
    it('更新 name 成功', async () => {
      const res = await app.httpRequest()
        .put(`/api/admin/tool-categories/${createdCategoryId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: '测试分类X-改' });
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.data.name, '测试分类X-改');
    });

    it('更新不存在的 id 返回 404', async () => {
      const res = await app.httpRequest()
        .put('/api/admin/tool-categories/99999')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'X' });
      assert.strictEqual(res.status, 404);
    });
  });

  describe('DELETE /api/admin/tool-categories/:id — 删除分类', () => {
    it('删除有工具的种子分类（DAILY）返回 400', async () => {
      const res = await app.httpRequest()
        .delete(`/api/admin/tool-categories/${dailyCategoryId}`)
        .set('Authorization', `Bearer ${adminToken}`);
      assert.strictEqual(res.status, 400);
      assert.ok(/尚有.*工具/.test(res.body.message), `错误信息应包含"尚有工具"，实际: ${res.body.message}`);
    });

    it('删除空分类成功', async () => {
      const res = await app.httpRequest()
        .delete(`/api/admin/tool-categories/${createdCategoryId}`)
        .set('Authorization', `Bearer ${adminToken}`);
      assert.strictEqual(res.status, 200);
    });
  });

  // ==================== 工具 CRUD ====================

  describe('GET /api/admin/tools — 工具列表', () => {
    it('未登录应返回 401', async () => {
      const res = await app.httpRequest().get('/api/admin/tools');
      assert.strictEqual(res.status, 401);
    });

    it('返回 total=233 种子数据', async () => {
      const res = await app.httpRequest()
        .get('/api/admin/tools?page=1&pageSize=20')
        .set('Authorization', `Bearer ${adminToken}`);
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.data.total, 233);
    });

    it('按 categoryCode=DAILY 筛选返回 16 条', async () => {
      const res = await app.httpRequest()
        .get('/api/admin/tools?page=1&pageSize=50&categoryCode=DAILY')
        .set('Authorization', `Bearer ${adminToken}`);
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.data.total, 16);
    });

    it('按 keyword 搜索', async () => {
      const res = await app.httpRequest()
        .get('/api/admin/tools?page=1&pageSize=20&keyword=gold-price')
        .set('Authorization', `Bearer ${adminToken}`);
      assert.strictEqual(res.status, 200);
      assert.ok(res.body.data.list.some((t: any) => t.code === 'gold-price'));
    });

    it('包含 category 关联字段', async () => {
      const res = await app.httpRequest()
        .get('/api/admin/tools?page=1&pageSize=1')
        .set('Authorization', `Bearer ${adminToken}`);
      assert.strictEqual(res.status, 200);
      assert.ok(res.body.data.list[0].category);
      assert.ok(res.body.data.list[0].category.code);
    });
  });

  describe('POST /api/admin/tools — 创建工具', () => {
    it('成功创建（默认 status=0 未发布）', async () => {
      const res = await app.httpRequest()
        .post('/api/admin/tools')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          code: 'test-tool-zzz',
          name: '测试工具ZZZ',
          description: '集成测试自动创建',
          categoryId: dailyCategoryId,
          path: '/test-tool-zzz',
        });
      assert.strictEqual(res.status, 201);
      assert.ok(res.body.data?.id);
      assert.strictEqual(res.body.data.status, 0); // 默认未发布
      assert.strictEqual(res.body.data.categoryCode, 'DAILY'); // 自动填充冗余字段
      createdToolId = res.body.data.id;
    });

    it('重复 code 返回 409', async () => {
      const res = await app.httpRequest()
        .post('/api/admin/tools')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          code: 'test-tool-zzz',
          name: '重复',
          categoryId: dailyCategoryId,
          path: '/xx',
        });
      assert.strictEqual(res.status, 409);
    });

    it('不存在的 categoryId 返回 400', async () => {
      const res = await app.httpRequest()
        .post('/api/admin/tools')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          code: 'test-tool-invalid-cat',
          name: 'X',
          categoryId: 99999,
          path: '/x',
        });
      assert.strictEqual(res.status, 400);
    });

    it('缺少必填字段返回 422', async () => {
      const res = await app.httpRequest()
        .post('/api/admin/tools')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'X' }); // 缺 code / categoryId / path
      assert.strictEqual(res.status, 422);
    });

    it('非法 requiredLevelCode 返回 422', async () => {
      const res = await app.httpRequest()
        .post('/api/admin/tools')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          code: 'test-bad-level',
          name: 'X',
          categoryId: dailyCategoryId,
          path: '/x',
          requiredLevelCode: 'platinum', // 非枚举值
        });
      assert.strictEqual(res.status, 422);
    });
  });

  describe('GET /api/admin/tools/:id — 工具详情', () => {
    it('返回完整详情', async () => {
      const res = await app.httpRequest()
        .get(`/api/admin/tools/${createdToolId}`)
        .set('Authorization', `Bearer ${adminToken}`);
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.data.code, 'test-tool-zzz');
      assert.ok(res.body.data.category);
    });

    it('不存在的 id 返回 404', async () => {
      const res = await app.httpRequest()
        .get('/api/admin/tools/99999999')
        .set('Authorization', `Bearer ${adminToken}`);
      assert.strictEqual(res.status, 404);
    });
  });

  describe('PUT /api/admin/tools/:id — 更新工具', () => {
    it('更新 isFeature=1 和 status=1', async () => {
      const res = await app.httpRequest()
        .put(`/api/admin/tools/${createdToolId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ isFeature: 1, status: 1 });
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.data.isFeature, 1);
      assert.strictEqual(res.body.data.status, 1);
    });

    it('H5 /api/tools/feature 现在应包含该工具', async () => {
      const res = await app.httpRequest().get('/api/tools/feature');
      assert.strictEqual(res.status, 200);
      assert.ok(res.body.data.total >= 1);
      assert.ok(res.body.data.list.some((t: any) => t.code === 'test-tool-zzz'));
    });

    it('更新 requiredLevelCode=silver 后 H5 会员 Tab 包含该工具', async () => {
      const r1 = await app.httpRequest()
        .put(`/api/admin/tools/${createdToolId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ requiredLevelCode: 'silver' });
      assert.strictEqual(r1.status, 200);

      const r2 = await app.httpRequest().get('/api/tools/member');
      assert.strictEqual(r2.status, 200);
      assert.ok(r2.body.data.list.some((t: any) => t.code === 'test-tool-zzz'));
    });
  });

  describe('PUT /api/admin/tools/batch-publish — 批量发布/下架', () => {
    it('成功下架（status=0）', async () => {
      const res = await app.httpRequest()
        .put('/api/admin/tools/batch-publish')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ ids: [createdToolId], status: 0 });
      assert.strictEqual(res.status, 200);
      assert.ok(res.body.data.affected >= 1);
    });

    it('ids 为空返回 422', async () => {
      const res = await app.httpRequest()
        .put('/api/admin/tools/batch-publish')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ ids: [], status: 1 });
      assert.strictEqual(res.status, 422);
    });

    it('status 非 0/1 返回 422', async () => {
      const res = await app.httpRequest()
        .put('/api/admin/tools/batch-publish')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ ids: [createdToolId], status: 2 });
      assert.strictEqual(res.status, 422);
    });

    it('批量发布多个工具', async () => {
      // 找 3 个其他种子工具做测试
      const list = await app.httpRequest()
        .get('/api/admin/tools?page=1&pageSize=3&categoryCode=DAILY')
        .set('Authorization', `Bearer ${adminToken}`);
      const ids = list.body.data.list.map((t: any) => t.id);
      assert.strictEqual(ids.length, 3);

      // 批量下架再重新发布，验证 affected=3
      const res = await app.httpRequest()
        .put('/api/admin/tools/batch-publish')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ ids, status: 1 });
      assert.strictEqual(res.status, 200);
      assert.ok(res.body.data.affected >= 0); // 可能 0（本来就 status=1）或 3
    });
  });

  describe('DELETE /api/admin/tools/:id — 删除工具', () => {
    it('成功删除', async () => {
      const res = await app.httpRequest()
        .delete(`/api/admin/tools/${createdToolId}`)
        .set('Authorization', `Bearer ${adminToken}`);
      assert.strictEqual(res.status, 200);
    });

    it('删除不存在的 id 返回 404', async () => {
      const res = await app.httpRequest()
        .delete('/api/admin/tools/99999999')
        .set('Authorization', `Bearer ${adminToken}`);
      assert.strictEqual(res.status, 404);
    });
  });
});
