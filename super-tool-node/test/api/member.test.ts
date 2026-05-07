import * as assert from 'assert';
import { app } from 'egg-mock/bootstrap';

describe('会员模块 (Member) API', () => {
  let adminToken: string;
  let testUserId: number;

  before(async () => {
    // 登录获取 admin token
    const res = await app.httpRequest().post('/api/auth/login').send({
      username: 'admin',
      password: 'Admin@123456',
      clientId: 'web_client',
      clientSecret: 'CHANGE_ME_WEB_SECRET',
    });
    adminToken = res.body.data?.accessToken;
    assert.ok(adminToken, '获取 admin token 失败');
  });

  // ==================== 公开接口 ====================

  describe('GET /api/member/levels — 获取成长等级列表（公开）', () => {
    it('无需认证即可获取', async () => {
      const res = await app.httpRequest().get('/api/member/levels');
      assert.strictEqual(res.status, 200);
      assert.ok(Array.isArray(res.body.data));
      assert.ok(res.body.data.length >= 5, '应至少有5个等级');
      // 验证排序
      const levels = res.body.data;
      assert.strictEqual(levels[0].code, 'free');
      assert.strictEqual(levels[levels.length - 1].code, 'black');
      // 验证权益 JSON
      assert.ok(levels[0].benefits, '应包含 benefits');
      assert.strictEqual(typeof levels[0].benefits.discount, 'number');
    });
  });

  describe('GET /api/member/plans — 获取付费套餐列表（公开）', () => {
    it('无需认证即可获取', async () => {
      const res = await app.httpRequest().get('/api/member/plans');
      assert.strictEqual(res.status, 200);
      assert.ok(Array.isArray(res.body.data));
      assert.ok(res.body.data.length >= 4, '应至少有4个套餐');
      // 验证价格
      const monthly = res.body.data.find((p: any) => p.code === 'monthly');
      assert.ok(monthly, '应包含月度套餐');
      assert.ok(Number(monthly.price) > 0, '价格应大于0');
    });
  });

  // ==================== 需认证接口 ====================

  describe('GET /api/member/info — 获取会员信息', () => {
    it('未登录应返回 401', async () => {
      const res = await app.httpRequest().get('/api/member/info');
      assert.strictEqual(res.status, 401);
    });

    it('已登录应返回会员信息', async () => {
      const res = await app.httpRequest()
        .get('/api/member/info')
        .set('Authorization', `Bearer ${adminToken}`);
      // admin 用户可能没有会员记录，404 或 200 都可接受
      assert.ok([200, 404].includes(res.status));
      if (res.status === 200) {
        assert.ok(res.body.data.level, '应包含等级信息');
        assert.ok(typeof res.body.data.points === 'number', '应包含积分');
        assert.ok(res.body.data.paid !== undefined, '应包含付费信息');
      }
    });
  });

  describe('GET /api/member/benefits — 获取聚合权益', () => {
    it('已登录应返回权益信息', async () => {
      const res = await app.httpRequest()
        .get('/api/member/benefits')
        .set('Authorization', `Bearer ${adminToken}`);
      assert.ok([200, 404].includes(res.status));
      if (res.status === 200) {
        assert.ok(res.body.data.benefits, '应包含权益对象');
        assert.ok(typeof res.body.data.benefits.discount === 'number');
      }
    });
  });

  describe('POST /api/member/daily-sign — 每日签到', () => {
    it('未登录应返回 401', async () => {
      const res = await app.httpRequest().post('/api/member/daily-sign');
      assert.strictEqual(res.status, 401);
    });
  });

  describe('GET /api/member/points-logs — 积分流水', () => {
    it('未登录应返回 401', async () => {
      const res = await app.httpRequest().get('/api/member/points-logs');
      assert.strictEqual(res.status, 401);
    });

    it('已登录应返回分页数据', async () => {
      const res = await app.httpRequest()
        .get('/api/member/points-logs?page=1&pageSize=10')
        .set('Authorization', `Bearer ${adminToken}`);
      assert.strictEqual(res.status, 200);
      assert.ok(res.body.data.list !== undefined, '应包含 list');
      assert.ok(res.body.data.total !== undefined, '应包含 total');
    });
  });

  // ==================== 管理端接口 ====================

  describe('GET /api/admin/member/levels — 管理端获取等级列表', () => {
    it('应返回等级列表', async () => {
      const res = await app.httpRequest()
        .get('/api/admin/member/levels')
        .set('Authorization', `Bearer ${adminToken}`);
      assert.strictEqual(res.status, 200);
      assert.ok(Array.isArray(res.body.data));
    });
  });

  describe('GET /api/admin/member/plans — 管理端获取套餐列表', () => {
    it('应返回套餐列表', async () => {
      const res = await app.httpRequest()
        .get('/api/admin/member/plans')
        .set('Authorization', `Bearer ${adminToken}`);
      assert.strictEqual(res.status, 200);
      assert.ok(Array.isArray(res.body.data));
    });
  });

  describe('GET /api/admin/member/users — 会员用户列表', () => {
    it('应返回分页数据', async () => {
      const res = await app.httpRequest()
        .get('/api/admin/member/users?page=1&pageSize=10')
        .set('Authorization', `Bearer ${adminToken}`);
      assert.strictEqual(res.status, 200);
      assert.ok(res.body.data.list !== undefined);
      assert.ok(res.body.data.total !== undefined);
    });

    it('支持按等级筛选', async () => {
      const res = await app.httpRequest()
        .get('/api/admin/member/users?levelCode=free')
        .set('Authorization', `Bearer ${adminToken}`);
      assert.strictEqual(res.status, 200);
    });
  });

  describe('GET /api/admin/member/stats — 会员统计', () => {
    it('应返回统计数据', async () => {
      const res = await app.httpRequest()
        .get('/api/admin/member/stats')
        .set('Authorization', `Bearer ${adminToken}`);
      assert.strictEqual(res.status, 200);
      assert.ok(res.body.data, '应包含 data');
      assert.ok(res.body.data.totalMembers !== undefined, '应包含 totalMembers');
      assert.ok(res.body.data.paidMembers !== undefined, '应包含 paidMembers');
      assert.ok(res.body.data.paidRate !== undefined, '应包含 paidRate');
    });
  });

  describe('POST /api/admin/member/users/:id/adjust-points — 手动调整积分', () => {
    it('缺少备注应返回 422', async () => {
      const res = await app.httpRequest()
        .post('/api/admin/member/users/1/adjust-points')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ points: 100 });
      assert.ok([400, 422].includes(res.status), '缺少备注应报错');
    });
  });

  describe('GET /api/admin/member/points-logs — 全局积分流水', () => {
    it('应返回分页数据', async () => {
      const res = await app.httpRequest()
        .get('/api/admin/member/points-logs?page=1&pageSize=10')
        .set('Authorization', `Bearer ${adminToken}`);
      assert.strictEqual(res.status, 200);
      assert.ok(res.body.data.list !== undefined);
    });
  });
});
