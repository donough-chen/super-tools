import * as assert from 'assert';
import { app } from 'egg-mock/bootstrap';

describe('用户收藏工具 (Favorite) API', () => {
  let adminToken: string;
  let createdToolCodes: string[] = [];

  // 使用种子数据中的真实工具 code 作为测试素材
  const TOOL_A = 'gold-price';
  const TOOL_B = 'oil-price';
  const TOOL_C = 'calculator';

  before(async () => {
    const res = await app.httpRequest().post('/api/auth/login').send({
      username: 'admin',
      password: 'Admin@123456',
      clientId: 'h5_client',
      clientSecret: 'H5_WEB_SECRET',
    });
    adminToken = res.body.data?.accessToken;
    assert.ok(adminToken, '获取 admin token 失败');
  });

  // 每个 describe 开始前清理已有收藏，保证隔离
  async function cleanup() {
    for (const code of [TOOL_A, TOOL_B, TOOL_C, ...createdToolCodes]) {
      await app.httpRequest()
        .delete(`/api/favorites/${code}`)
        .set('Authorization', `Bearer ${adminToken}`);
    }
    createdToolCodes = [];
  }

  // ==================== POST /api/favorites ====================

  describe('POST /api/favorites — 收藏工具', () => {
    before(cleanup);
    after(cleanup);

    it('未登录应返回 401', async () => {
      const res = await app.httpRequest()
        .post('/api/favorites')
        .send({ toolCode: TOOL_A });
      assert.strictEqual(res.status, 401);
    });

    it('缺少 toolId 与 toolCode → 422', async () => {
      const res = await app.httpRequest()
        .post('/api/favorites')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({});
      assert.strictEqual(res.status, 422);
    });

    it('不存在的 toolCode → 404', async () => {
      const res = await app.httpRequest()
        .post('/api/favorites')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ toolCode: '__not_exist_tool__' });
      assert.strictEqual(res.status, 404);
    });

    it('正常收藏 → 201，返回 favorite 信息', async () => {
      const res = await app.httpRequest()
        .post('/api/favorites')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ toolCode: TOOL_A });
      assert.strictEqual(res.status, 201);
      assert.ok(res.body.data.id);
      assert.strictEqual(res.body.data.toolCode, TOOL_A);
      assert.strictEqual(typeof res.body.data.sort, 'number');
      createdToolCodes.push(TOOL_A);
    });

    it('重复收藏同一工具 → 409', async () => {
      const res = await app.httpRequest()
        .post('/api/favorites')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ toolCode: TOOL_A });
      assert.strictEqual(res.status, 409);
    });

    it('新收藏的 sort 应大于旧收藏', async () => {
      const res = await app.httpRequest()
        .post('/api/favorites')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ toolCode: TOOL_B });
      assert.strictEqual(res.status, 201);
      assert.ok(res.body.data.sort > 0);
      createdToolCodes.push(TOOL_B);
    });
  });

  // ==================== GET /api/favorites ====================

  describe('GET /api/favorites — 收藏列表', () => {
    before(async () => {
      await cleanup();
      // 预先插入 3 条收藏
      for (const code of [TOOL_A, TOOL_B, TOOL_C]) {
        await app.httpRequest()
          .post('/api/favorites')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ toolCode: code });
      }
    });
    after(cleanup);

    it('未登录应返回 401', async () => {
      const res = await app.httpRequest().get('/api/favorites');
      assert.strictEqual(res.status, 401);
    });

    it('返回分页结构 + 3 条收藏', async () => {
      const res = await app.httpRequest()
        .get('/api/favorites')
        .set('Authorization', `Bearer ${adminToken}`);
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.data.total, 3);
      assert.strictEqual(res.body.data.list.length, 3);
      // 响应包含嵌套的 tool 信息
      const first = res.body.data.list[0];
      assert.ok(first.tool);
      assert.ok(first.tool.name);
      assert.ok(first.tool.path);
    });

    it('按 sort ASC 排序（默认第一条是最先收藏的）', async () => {
      const res = await app.httpRequest()
        .get('/api/favorites')
        .set('Authorization', `Bearer ${adminToken}`);
      assert.strictEqual(res.body.data.list[0].toolCode, TOOL_A);
      assert.strictEqual(res.body.data.list[1].toolCode, TOOL_B);
      assert.strictEqual(res.body.data.list[2].toolCode, TOOL_C);
    });

    it('keyword=黄金 → 只返回名称/描述含黄金的', async () => {
      const res = await app.httpRequest()
        .get('/api/favorites?keyword=' + encodeURIComponent('黄金'))
        .set('Authorization', `Bearer ${adminToken}`);
      assert.strictEqual(res.status, 200);
      assert.ok(res.body.data.total >= 1);
      const codes = res.body.data.list.map((r: any) => r.toolCode);
      assert.ok(codes.includes(TOOL_A), `期望包含 ${TOOL_A}，实际 ${codes}`);
      assert.ok(!codes.includes(TOOL_B), `不应包含 ${TOOL_B}`);
    });

    it('categoryCode=DAILY → 只返回日常应用', async () => {
      const res = await app.httpRequest()
        .get('/api/favorites?categoryCode=DAILY')
        .set('Authorization', `Bearer ${adminToken}`);
      assert.strictEqual(res.status, 200);
      res.body.data.list.forEach((r: any) => {
        assert.strictEqual(r.tool.categoryCode, 'DAILY');
      });
    });

    it('分页参数生效', async () => {
      const res = await app.httpRequest()
        .get('/api/favorites?page=1&pageSize=2')
        .set('Authorization', `Bearer ${adminToken}`);
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.data.pageSize, 2);
      assert.strictEqual(res.body.data.list.length, 2);
      assert.strictEqual(res.body.data.totalPages, 2);
    });
  });

  // ==================== GET /api/favorites/codes ====================

  describe('GET /api/favorites/codes — 轻量 code 列表', () => {
    before(async () => {
      await cleanup();
      for (const code of [TOOL_A, TOOL_B]) {
        await app.httpRequest()
          .post('/api/favorites')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ toolCode: code });
      }
    });
    after(cleanup);

    it('返回 string 数组，包含已收藏 code', async () => {
      const res = await app.httpRequest()
        .get('/api/favorites/codes')
        .set('Authorization', `Bearer ${adminToken}`);
      assert.strictEqual(res.status, 200);
      assert.ok(Array.isArray(res.body.data));
      assert.ok(res.body.data.includes(TOOL_A));
      assert.ok(res.body.data.includes(TOOL_B));
      assert.strictEqual(res.body.data.length, 2);
    });
  });

  // ==================== GET /api/favorites/check/:toolCode ====================

  describe('GET /api/favorites/check/:toolCode — 单个收藏态', () => {
    before(async () => {
      await cleanup();
      await app.httpRequest()
        .post('/api/favorites')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ toolCode: TOOL_A });
    });
    after(cleanup);

    it('已收藏 → favorited=true', async () => {
      const res = await app.httpRequest()
        .get(`/api/favorites/check/${TOOL_A}`)
        .set('Authorization', `Bearer ${adminToken}`);
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.data.favorited, true);
      assert.strictEqual(typeof res.body.data.sort, 'number');
    });

    it('未收藏 → favorited=false', async () => {
      const res = await app.httpRequest()
        .get(`/api/favorites/check/${TOOL_C}`)
        .set('Authorization', `Bearer ${adminToken}`);
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.data.favorited, false);
    });
  });

  // ==================== PUT /api/favorites/reorder ====================

  describe('PUT /api/favorites/reorder — 拖拽排序', () => {
    before(async () => {
      await cleanup();
      for (const code of [TOOL_A, TOOL_B, TOOL_C]) {
        await app.httpRequest()
          .post('/api/favorites')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ toolCode: code });
      }
    });
    after(cleanup);

    it('orderedToolCodes 为空 → 422', async () => {
      const res = await app.httpRequest()
        .put('/api/favorites/reorder')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ orderedToolCodes: [] });
      assert.strictEqual(res.status, 422);
    });

    it('含非已收藏 code → 400', async () => {
      const res = await app.httpRequest()
        .put('/api/favorites/reorder')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ orderedToolCodes: [TOOL_A, TOOL_B, '__not_exist__'] });
      assert.strictEqual(res.status, 400);
    });

    it('数量不匹配 → 400', async () => {
      const res = await app.httpRequest()
        .put('/api/favorites/reorder')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ orderedToolCodes: [TOOL_A, TOOL_B] });
      assert.strictEqual(res.status, 400);
    });

    it('重复项 → 422', async () => {
      const res = await app.httpRequest()
        .put('/api/favorites/reorder')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ orderedToolCodes: [TOOL_A, TOOL_A, TOOL_B] });
      assert.strictEqual(res.status, 422);
    });

    it('正常排序 → affected=3，新顺序生效', async () => {
      const newOrder = [TOOL_C, TOOL_A, TOOL_B];
      const res = await app.httpRequest()
        .put('/api/favorites/reorder')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ orderedToolCodes: newOrder });
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.data.affected, 3);

      // 校验列表顺序
      const listRes = await app.httpRequest()
        .get('/api/favorites')
        .set('Authorization', `Bearer ${adminToken}`);
      const codes = listRes.body.data.list.map((r: any) => r.toolCode);
      assert.deepStrictEqual(codes, newOrder);
    });
  });

  // ==================== DELETE /api/favorites/:toolCode ====================

  describe('DELETE /api/favorites/:toolCode — 取消收藏', () => {
    before(async () => {
      await cleanup();
      await app.httpRequest()
        .post('/api/favorites')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ toolCode: TOOL_A });
    });
    after(cleanup);

    it('取消已收藏 → 200', async () => {
      const res = await app.httpRequest()
        .delete(`/api/favorites/${TOOL_A}`)
        .set('Authorization', `Bearer ${adminToken}`);
      assert.strictEqual(res.status, 200);
    });

    it('取消未收藏的 → 404', async () => {
      const res = await app.httpRequest()
        .delete(`/api/favorites/${TOOL_C}`)
        .set('Authorization', `Bearer ${adminToken}`);
      assert.strictEqual(res.status, 404);
    });
  });
});
