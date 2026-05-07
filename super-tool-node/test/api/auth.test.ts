import assert from 'assert';
import { MockApplication } from 'egg-mock';
import mm from 'egg-mock';
import {
  testCtx,
  TEST_CLIENT,
  TEST_ADMIN,
  TEST_USER,
  assertSuccess,
} from '../helpers/setup';

describe('Auth API /api/auth', () => {
  let app: MockApplication;

  before(async () => {
    app = mm.app({ baseDir: process.cwd() });
    await app.ready();
  });

  after(async () => {
    await app.close();
    mm.restore();
  });

  // ==================== 密码登录 ====================

  describe('POST /api/auth/login', () => {
    it('login success', async () => {
      const res = await app.httpRequest()
        .post('/api/auth/login')
        .send({
          username: TEST_ADMIN.username,
          password: TEST_ADMIN.password,
          clientId: TEST_CLIENT.clientId,
          clientSecret: TEST_CLIENT.clientSecret,
        })
        .expect(200);

      assertSuccess(res.body);
      assert.ok(res.body.data.accessToken, 'should have accessToken');
      assert.ok(res.body.data.refreshToken, 'should have refreshToken');
      testCtx.adminToken = res.body.data.accessToken;
      testCtx.refreshToken = res.body.data.refreshToken;
    });

    it('wrong password returns 401', async () => {
      const res = await app.httpRequest()
        .post('/api/auth/login')
        .send({
          username: TEST_ADMIN.username,
          password: 'WrongPassword!',
          clientId: TEST_CLIENT.clientId,
          clientSecret: TEST_CLIENT.clientSecret,
        })
        .expect(401);
      assert.ok(res.body, 'should return error');
    });

    it('missing username returns 422', async () => {
      const res = await app.httpRequest()
        .post('/api/auth/login')
        .send({
          password: TEST_ADMIN.password,
          clientId: TEST_CLIENT.clientId,
          clientSecret: TEST_CLIENT.clientSecret,
        })
        .expect(422);
      assert.ok(res.body, 'should return error');
    });

    it('invalid clientId returns 4xx', async () => {
      const res = await app.httpRequest()
        .post('/api/auth/login')
        .send({
          username: TEST_ADMIN.username,
          password: TEST_ADMIN.password,
          clientId: 'invalid-client',
          clientSecret: 'invalid-secret',
        });
      assert.ok(res.status >= 400, 'should return 4xx, got ' + res.status);
    });
  });

  // ==================== 微信登录（策略模式） ====================

  describe('POST /api/auth/wechat-login', () => {
    it('missing code returns 422', async () => {
      const res = await app.httpRequest()
        .post('/api/auth/wechat-login')
        .send({
          platform: 'miniprogram',
          clientId: TEST_CLIENT.clientId,
          clientSecret: TEST_CLIENT.clientSecret,
        })
        .expect(422);
      assert.ok(res.body, 'should return validation error');
    });

    it('missing platform returns 422', async () => {
      const res = await app.httpRequest()
        .post('/api/auth/wechat-login')
        .send({
          code: 'test_wechat_code',
          clientId: TEST_CLIENT.clientId,
          clientSecret: TEST_CLIENT.clientSecret,
        })
        .expect(422);
      assert.ok(res.body, 'should return validation error');
    });

    it('missing clientId returns 422', async () => {
      const res = await app.httpRequest()
        .post('/api/auth/wechat-login')
        .send({
          code: 'test_wechat_code',
          platform: 'miniprogram',
          clientSecret: TEST_CLIENT.clientSecret,
        })
        .expect(422);
      assert.ok(res.body, 'should return validation error');
    });

    it('invalid wechat code returns 4xx (not 5xx)', async () => {
      const res = await app.httpRequest()
        .post('/api/auth/wechat-login')
        .send({
          code: 'invalid_wechat_code_' + Date.now(),
          platform: 'miniprogram',
          clientId: TEST_CLIENT.clientId,
          clientSecret: TEST_CLIENT.clientSecret,
        });
      assert.ok(res.status < 500, 'should not return 5xx, got ' + res.status);
    });
  });

  // ==================== 手机号验证码登录 ====================

  describe('POST /api/auth/phone-login', () => {
    it('missing phone returns 422', async () => {
      const res = await app.httpRequest()
        .post('/api/auth/phone-login')
        .send({
          code: '123456',
          clientId: TEST_CLIENT.clientId,
          clientSecret: TEST_CLIENT.clientSecret,
        })
        .expect(422);
      assert.ok(res.body, 'should return validation error');
    });

    it('missing code returns 422', async () => {
      const res = await app.httpRequest()
        .post('/api/auth/phone-login')
        .send({
          phone: '13800138000',
          clientId: TEST_CLIENT.clientId,
          clientSecret: TEST_CLIENT.clientSecret,
        })
        .expect(422);
      assert.ok(res.body, 'should return validation error');
    });

    it('missing clientId returns 422', async () => {
      const res = await app.httpRequest()
        .post('/api/auth/phone-login')
        .send({
          phone: '13800138000',
          code: '123456',
          clientSecret: TEST_CLIENT.clientSecret,
        })
        .expect(422);
      assert.ok(res.body, 'should return validation error');
    });

    it('invalid verify code returns 4xx (not 5xx)', async () => {
      const res = await app.httpRequest()
        .post('/api/auth/phone-login')
        .send({
          phone: '13800138000',
          code: '000000',
          clientId: TEST_CLIENT.clientId,
          clientSecret: TEST_CLIENT.clientSecret,
        });
      assert.ok(res.status < 500, 'should not return 5xx, got ' + res.status);
    });
  });

  // ==================== 获取微信H5授权URL ====================

  describe('GET /api/auth/wechat-auth-url', () => {
    it('missing redirectUri returns 400', async () => {
      const res = await app.httpRequest()
        .get('/api/auth/wechat-auth-url')
        .expect(400);
      assert.ok(res.body, 'should return error');
    });

    it('with redirectUri returns url (not 5xx)', async () => {
      const res = await app.httpRequest()
        .get('/api/auth/wechat-auth-url?redirectUri=https://example.com/callback&state=test123');
      assert.ok(res.status < 500, 'should not return 5xx, got ' + res.status);
      if (res.status === 200) {
        assertSuccess(res.body);
        assert.ok(res.body.data.url, 'should return url');
      }
    });
  });

  // ==================== 注册 ====================

  describe('POST /api/auth/register', () => {
    it('register success returns 201', async () => {
      const res = await app.httpRequest()
        .post('/api/auth/register')
        .send({
          username: TEST_USER.username,
          email: TEST_USER.email,
          password: TEST_USER.password,
          nickname: TEST_USER.nickname,
          clientId: TEST_CLIENT.clientId,
        })
        .expect(201);
      assertSuccess(res.body, 201);
      assert.ok(res.body.data, 'should return user data');
    });

    it('duplicate username returns 4xx', async () => {
      const res = await app.httpRequest()
        .post('/api/auth/register')
        .send({
          username: TEST_USER.username,
          email: 'dup_' + TEST_USER.email,
          password: TEST_USER.password,
          clientId: TEST_CLIENT.clientId,
        });
      assert.ok(res.status >= 400, 'duplicate should return 4xx, got ' + res.status);
    });

    it('short password returns 422', async () => {
      const res = await app.httpRequest()
        .post('/api/auth/register')
        .send({
          username: 'short_' + Date.now(),
          email: 'short_' + Date.now() + '@example.com',
          password: '123',
          clientId: TEST_CLIENT.clientId,
        })
        .expect(422);
      assert.ok(res.body, 'should return error');
    });

    it('invalid email returns 422', async () => {
      const res = await app.httpRequest()
        .post('/api/auth/register')
        .send({
          username: 'emailtest_' + Date.now(),
          email: 'not-an-email',
          password: 'ValidPass@123',
          clientId: TEST_CLIENT.clientId,
        })
        .expect(422);
      assert.ok(res.body, 'should return error');
    });
  });

  // ==================== 发送验证码 ====================

  describe('POST /api/auth/send-code', () => {
    it('missing target returns 422', async () => {
      const res = await app.httpRequest()
        .post('/api/auth/send-code')
        .send({ type: 'login' })
        .expect(422);
      assert.ok(res.body, 'should return validation error');
    });

    it('missing type returns 422', async () => {
      const res = await app.httpRequest()
        .post('/api/auth/send-code')
        .send({ target: '13800138000' })
        .expect(422);
      assert.ok(res.body, 'should return validation error');
    });

    it('send code with valid params (not 5xx)', async () => {
      const res = await app.httpRequest()
        .post('/api/auth/send-code')
        .send({
          target: '13800138000',
          type: 'login',
          platform: 'h5',
        });
      // 验证码发送可能因短信服务未配置返回 4xx，但不应 5xx
      assert.ok(res.status < 500, 'should not return 5xx, got ' + res.status);
    });
  });

  // ==================== 刷新 Token ====================

  describe('POST /api/auth/refresh', () => {
    it('refresh with valid token returns new accessToken', async () => {
      assert.ok(testCtx.refreshToken, 'need refreshToken from login test');
      const res = await app.httpRequest()
        .post('/api/auth/refresh')
        .send({ refreshToken: testCtx.refreshToken })
        .expect(200);
      assertSuccess(res.body);
      assert.ok(res.body.data.accessToken, 'should return new accessToken');
      testCtx.adminToken = res.body.data.accessToken;
    });

    it('invalid refreshToken returns 401', async () => {
      const res = await app.httpRequest()
        .post('/api/auth/refresh')
        .send({ refreshToken: 'invalid.refresh.token' })
        .expect(401);
      assert.ok(res.body, 'should return error');
    });

    it('missing refreshToken returns 422', async () => {
      const res = await app.httpRequest()
        .post('/api/auth/refresh')
        .send({})
        .expect(422);
      assert.ok(res.body, 'should return error');
    });
  });

  // ==================== 会话管理 ====================

  describe('GET /api/auth/sessions', () => {
    it('get sessions with valid token', async () => {
      assert.ok(testCtx.adminToken, 'need adminToken');
      const res = await app.httpRequest()
        .get('/api/auth/sessions')
        .set('Authorization', `Bearer ${testCtx.adminToken}`)
        .expect(200);
      assertSuccess(res.body);
      assert.ok(Array.isArray(res.body.data), 'should return array');
      if (res.body.data.length > 0) {
        testCtx.sessionId = res.body.data[0].id || res.body.data[0].sessionId;
      }
    });

    it('no token returns 401', async () => {
      const res = await app.httpRequest()
        .get('/api/auth/sessions')
        .expect(401);
      assert.ok(res.body, 'should return error');
    });
  });

  describe('DELETE /api/auth/sessions/:id', () => {
    it('kick session', async () => {
      if (!testCtx.sessionId) { console.log('  skip: no session to kick'); return; }
      const res = await app.httpRequest()
        .delete(`/api/auth/sessions/${testCtx.sessionId}`)
        .set('Authorization', `Bearer ${testCtx.adminToken}`)
        .expect(200);
      assertSuccess(res.body);
    });
  });

  // ==================== 登出 ====================

  describe('POST /api/auth/logout', () => {
    it('logout success', async () => {
      const loginRes = await app.httpRequest()
        .post('/api/auth/login')
        .send({
          username: TEST_ADMIN.username,
          password: TEST_ADMIN.password,
          clientId: TEST_CLIENT.clientId,
          clientSecret: TEST_CLIENT.clientSecret,
        });
      const token = loginRes.body.data && loginRes.body.data.accessToken;
      if (!token) return;
      const res = await app.httpRequest()
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      assertSuccess(res.body);
    });

    it('no token returns 401', async () => {
      const res = await app.httpRequest()
        .post('/api/auth/logout')
        .expect(401);
      assert.ok(res.body, 'should return error');
    });
  });

  // ==================== 账号绑定 ====================

  describe('POST /api/auth/bind/phone', () => {
    let bindToken = '';

    before(async () => {
      // 重新登录获取有效 token
      const res = await app.httpRequest()
        .post('/api/auth/login')
        .send({
          username: TEST_ADMIN.username,
          password: TEST_ADMIN.password,
          clientId: TEST_CLIENT.clientId,
          clientSecret: TEST_CLIENT.clientSecret,
        });
      bindToken = res.body.data?.accessToken || '';
    });

    it('missing phone returns 422', async () => {
      if (!bindToken) return;
      const res = await app.httpRequest()
        .post('/api/auth/bind/phone')
        .set('Authorization', `Bearer ${bindToken}`)
        .send({ code: '123456' })
        .expect(422);
      assert.ok(res.body, 'should return validation error');
    });

    it('missing code returns 422', async () => {
      if (!bindToken) return;
      const res = await app.httpRequest()
        .post('/api/auth/bind/phone')
        .set('Authorization', `Bearer ${bindToken}`)
        .send({ phone: '13800138000' })
        .expect(422);
      assert.ok(res.body, 'should return validation error');
    });

    it('no token returns 401', async () => {
      const res = await app.httpRequest()
        .post('/api/auth/bind/phone')
        .send({ phone: '13800138000', code: '123456' })
        .expect(401);
      assert.ok(res.body, 'should return error');
    });

    it('invalid verify code returns 4xx (not 5xx)', async () => {
      if (!bindToken) return;
      const res = await app.httpRequest()
        .post('/api/auth/bind/phone')
        .set('Authorization', `Bearer ${bindToken}`)
        .send({ phone: '13800138999', code: '000000' });
      assert.ok(res.status < 500, 'should not return 5xx, got ' + res.status);
    });
  });

  describe('POST /api/auth/bind/wechat', () => {
    let bindToken = '';

    before(async () => {
      const res = await app.httpRequest()
        .post('/api/auth/login')
        .send({
          username: TEST_ADMIN.username,
          password: TEST_ADMIN.password,
          clientId: TEST_CLIENT.clientId,
          clientSecret: TEST_CLIENT.clientSecret,
        });
      bindToken = res.body.data?.accessToken || '';
    });

    it('missing platform returns 422', async () => {
      if (!bindToken) return;
      const res = await app.httpRequest()
        .post('/api/auth/bind/wechat')
        .set('Authorization', `Bearer ${bindToken}`)
        .send({ code: 'test_wechat_code' })
        .expect(422);
      assert.ok(res.body, 'should return validation error');
    });

    it('missing code returns 422', async () => {
      if (!bindToken) return;
      const res = await app.httpRequest()
        .post('/api/auth/bind/wechat')
        .set('Authorization', `Bearer ${bindToken}`)
        .send({ platform: 'miniprogram' })
        .expect(422);
      assert.ok(res.body, 'should return validation error');
    });

    it('no token returns 401', async () => {
      const res = await app.httpRequest()
        .post('/api/auth/bind/wechat')
        .send({ platform: 'miniprogram', code: 'test_code' })
        .expect(401);
      assert.ok(res.body, 'should return error');
    });

    it('invalid wechat code returns 4xx (not 5xx)', async () => {
      if (!bindToken) return;
      const res = await app.httpRequest()
        .post('/api/auth/bind/wechat')
        .set('Authorization', `Bearer ${bindToken}`)
        .send({ platform: 'miniprogram', code: 'invalid_code_' + Date.now() });
      assert.ok(res.status < 500, 'should not return 5xx, got ' + res.status);
    });
  });

  describe('POST /api/auth/bind/email', () => {
    let bindToken = '';

    before(async () => {
      const res = await app.httpRequest()
        .post('/api/auth/login')
        .send({
          username: TEST_ADMIN.username,
          password: TEST_ADMIN.password,
          clientId: TEST_CLIENT.clientId,
          clientSecret: TEST_CLIENT.clientSecret,
        });
      bindToken = res.body.data?.accessToken || '';
    });

    it('missing email returns 422', async () => {
      if (!bindToken) return;
      const res = await app.httpRequest()
        .post('/api/auth/bind/email')
        .set('Authorization', `Bearer ${bindToken}`)
        .send({ code: '123456' })
        .expect(422);
      assert.ok(res.body, 'should return validation error');
    });

    it('invalid email format returns 422', async () => {
      if (!bindToken) return;
      const res = await app.httpRequest()
        .post('/api/auth/bind/email')
        .set('Authorization', `Bearer ${bindToken}`)
        .send({ email: 'not-an-email', code: '123456' })
        .expect(422);
      assert.ok(res.body, 'should return validation error');
    });

    it('missing code returns 422', async () => {
      if (!bindToken) return;
      const res = await app.httpRequest()
        .post('/api/auth/bind/email')
        .set('Authorization', `Bearer ${bindToken}`)
        .send({ email: 'test@example.com' })
        .expect(422);
      assert.ok(res.body, 'should return validation error');
    });

    it('no token returns 401', async () => {
      const res = await app.httpRequest()
        .post('/api/auth/bind/email')
        .send({ email: 'test@example.com', code: '123456' })
        .expect(401);
      assert.ok(res.body, 'should return error');
    });

    it('invalid verify code returns 4xx (not 5xx)', async () => {
      if (!bindToken) return;
      const res = await app.httpRequest()
        .post('/api/auth/bind/email')
        .set('Authorization', `Bearer ${bindToken}`)
        .send({ email: 'bind_test_' + Date.now() + '@example.com', code: '000000' });
      assert.ok(res.status < 500, 'should not return 5xx, got ' + res.status);
    });
  });

  // ==================== 解绑 ====================

  describe('POST /api/auth/unbind', () => {
    let unbindToken = '';

    before(async () => {
      const res = await app.httpRequest()
        .post('/api/auth/login')
        .send({
          username: TEST_ADMIN.username,
          password: TEST_ADMIN.password,
          clientId: TEST_CLIENT.clientId,
          clientSecret: TEST_CLIENT.clientSecret,
        });
      unbindToken = res.body.data?.accessToken || '';
    });

    it('missing type returns 422', async () => {
      if (!unbindToken) return;
      const res = await app.httpRequest()
        .post('/api/auth/unbind')
        .set('Authorization', `Bearer ${unbindToken}`)
        .send({})
        .expect(422);
      assert.ok(res.body, 'should return validation error');
    });

    it('no token returns 401', async () => {
      const res = await app.httpRequest()
        .post('/api/auth/unbind')
        .send({ type: 'phone' })
        .expect(401);
      assert.ok(res.body, 'should return error');
    });

    it('unbind with valid type returns non-5xx', async () => {
      if (!unbindToken) return;
      const res = await app.httpRequest()
        .post('/api/auth/unbind')
        .set('Authorization', `Bearer ${unbindToken}`)
        .send({ type: 'wechat', platform: 'miniprogram' });
      // 可能因未绑定返回 4xx，但不应 5xx
      assert.ok(res.status < 500, 'should not return 5xx, got ' + res.status);
    });
  });

  // ==================== 绑定状态查询 ====================

  describe('GET /api/auth/bind-status', () => {
    let statusToken = '';

    before(async () => {
      const res = await app.httpRequest()
        .post('/api/auth/login')
        .send({
          username: TEST_ADMIN.username,
          password: TEST_ADMIN.password,
          clientId: TEST_CLIENT.clientId,
          clientSecret: TEST_CLIENT.clientSecret,
        });
      statusToken = res.body.data?.accessToken || '';
    });

    it('get bind status with valid token', async () => {
      if (!statusToken) return;
      const res = await app.httpRequest()
        .get('/api/auth/bind-status')
        .set('Authorization', `Bearer ${statusToken}`);
      // 绑定状态查询应该成功或合理返回
      assert.ok(res.status < 500, 'should not return 5xx, got ' + res.status);
      if (res.status === 200) {
        assertSuccess(res.body);
        assert.ok(res.body.data !== undefined, 'should return bind status data');
      }
    });

    it('no token returns 401', async () => {
      const res = await app.httpRequest()
        .get('/api/auth/bind-status')
        .expect(401);
      assert.ok(res.body, 'should return error');
    });
  });
});
