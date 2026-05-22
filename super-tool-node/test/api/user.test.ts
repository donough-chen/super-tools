import assert from 'assert';
import { MockApplication } from 'egg-mock';
import mm from 'egg-mock';
import { TEST_CLIENT, TEST_ADMIN, assertSuccess, assertPaginated } from '../helpers/setup';

describe('User API /api/users', () => {
  let app: MockApplication;
  let adminToken = '';
  let createdUserId = 0;
  let createdAddressId = 0;

  before(async () => {
    app = mm.app({ baseDir: process.cwd() });
    await app.ready();
    const res = await app.httpRequest()
      .post('/api/auth/login')
      .send({
        username: TEST_ADMIN.username,
        password: TEST_ADMIN.password,
        clientId: TEST_CLIENT.clientId,
        clientSecret: TEST_CLIENT.clientSecret,
      });
    adminToken = res.body.data && res.body.data.accessToken;
    if (!adminToken) throw new Error('admin login failed: ' + JSON.stringify(res.body));
  });

  after(async () => {
    await app.close();
    mm.restore();
  });

  // ==================== 用户列表（管理端） ====================

  describe('GET /api/users', () => {
    it('get user list returns paginated data', async () => {
      const res = await app.httpRequest()
        .get('/api/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      assertPaginated(res.body);
      assert.ok(typeof res.body.data.total === 'number');
    });

    it('search by keyword', async () => {
      const res = await app.httpRequest()
        .get('/api/users?keyword=admin&page=1&pageSize=10')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      assertPaginated(res.body);
    });

    it('filter by status', async () => {
      const res = await app.httpRequest()
        .get('/api/users?status=1&page=1&pageSize=5')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      assertPaginated(res.body);
    });

    it('no token returns 401', async () => {
      const res = await app.httpRequest()
        .get('/api/users')
        .expect(401);
      assert.ok(res.body);
    });
  });

  // ==================== 用户 CRUD（管理端） ====================

  describe('POST /api/users', () => {
    it('create user returns 201', async () => {
      const res = await app.httpRequest()
        .post('/api/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          username: 'mgr_user_' + Date.now(),
          email: 'mgr_' + Date.now() + '@example.com',
          password: 'Mgr@123456',
          nickname: 'Test Mgr User',
        })
        .expect(201);
      assertSuccess(res.body, 201);
      assert.ok(res.body.data.id);
      createdUserId = res.body.data.id;
    });

    it('missing username returns 422', async () => {
      const res = await app.httpRequest()
        .post('/api/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ password: 'Test@123456' })
        .expect(422);
      assert.ok(res.body);
    });

    it('short password returns 422', async () => {
      const res = await app.httpRequest()
        .post('/api/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ username: 'short_' + Date.now(), password: '123' })
        .expect(422);
      assert.ok(res.body);
    });
  });

  describe('GET /api/users/:id', () => {
    it('get user detail', async () => {
      assert.ok(createdUserId, 'need to create user first');
      const res = await app.httpRequest()
        .get(`/api/users/${createdUserId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      assertSuccess(res.body);
      assert.strictEqual(res.body.data.id, createdUserId);
    });

    it('not found returns 404', async () => {
      const res = await app.httpRequest()
        .get('/api/users/99999999')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);
      assert.ok(res.body);
    });
  });

  describe('PUT /api/users/:id', () => {
    it('update user success', async () => {
      assert.ok(createdUserId, 'need to create user first');
      const res = await app.httpRequest()
        .put(`/api/users/${createdUserId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ nickname: 'Updated Nickname' })
        .expect(200);
      assertSuccess(res.body);
    });
  });

  // ==================== 个人资料 ====================

  describe('GET /api/users/profile', () => {
    it('get current user profile', async () => {
      const res = await app.httpRequest()
        .get('/api/users/profile')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      assertSuccess(res.body);
      assert.ok(res.body.data.id);
      assert.ok(res.body.data.username);
      // 完整资料应包含 profile 扩展字段
      assert.ok(res.body.data.profile, 'should include profile extra');
    });

    it('no token returns 401', async () => {
      const res = await app.httpRequest()
        .get('/api/users/profile')
        .expect(401);
      assert.ok(res.body);
    });
  });

  describe('PUT /api/users/profile', () => {
    it('update profile with valid data', async () => {
      const res = await app.httpRequest()
        .put('/api/users/profile')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          nickname: 'AdminUpdated_' + Date.now(),
          bio: '这是一段测试简介',
        });
      assert.ok(res.status < 500, 'should not return 5xx, got ' + res.status);
      if (res.status === 200) {
        assertSuccess(res.body);
      }
    });

    it('update extended profile fields', async () => {
      const res = await app.httpRequest()
        .put('/api/users/profile')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          signature: '测试签名_' + Date.now(),
          language: 'zh-CN',
          timezone: 'Asia/Shanghai',
        });
      assert.ok(res.status < 500, 'should not return 5xx, got ' + res.status);
    });

    it('no token returns 401', async () => {
      const res = await app.httpRequest()
        .put('/api/users/profile')
        .send({ nickname: 'Unauthorized' })
        .expect(401);
      assert.ok(res.body);
    });
  });

  // ==================== 修改密码 ====================

  describe('PUT /api/users/password', () => {
    it('wrong old password returns 4xx', async () => {
      const res = await app.httpRequest()
        .put('/api/users/password')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ oldPassword: 'WrongOldPass!', newPassword: 'NewPass@123456' });
      assert.ok(res.status >= 400, 'should return 4xx, got ' + res.status);
    });

    it('short new password returns 422', async () => {
      const res = await app.httpRequest()
        .put('/api/users/password')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ oldPassword: TEST_ADMIN.password, newPassword: '123' })
        .expect(422);
      assert.ok(res.body);
    });
  });

  // ==================== 设备管理 ====================

  describe('POST /api/users/devices', () => {
    const testDeviceId = 'test_device_' + Date.now();

    it('register device with valid data', async () => {
      const res = await app.httpRequest()
        .post('/api/users/devices')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          deviceId: testDeviceId,
          deviceType: 'ios',
          deviceName: 'iPhone 15 Test',
          osVersion: 'iOS 18.0',
          appVersion: '1.0.0',
        });
      assert.ok(res.status < 500, 'should not return 5xx, got ' + res.status);
      if (res.status === 200) {
        assertSuccess(res.body);
      }
    });

    it('missing deviceId returns 422', async () => {
      const res = await app.httpRequest()
        .post('/api/users/devices')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          deviceType: 'ios',
          deviceName: 'iPhone 15',
        })
        .expect(422);
      assert.ok(res.body, 'should return validation error');
    });

    it('missing deviceType returns 422', async () => {
      const res = await app.httpRequest()
        .post('/api/users/devices')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          deviceId: 'device_no_type_' + Date.now(),
        })
        .expect(422);
      assert.ok(res.body, 'should return validation error');
    });

    it('no token returns 401', async () => {
      const res = await app.httpRequest()
        .post('/api/users/devices')
        .send({
          deviceId: 'unauthorized_device',
          deviceType: 'android',
        })
        .expect(401);
      assert.ok(res.body);
    });
  });

  describe('GET /api/users/devices', () => {
    it('get device list with valid token', async () => {
      const res = await app.httpRequest()
        .get('/api/users/devices')
        .set('Authorization', `Bearer ${adminToken}`);
      assert.ok(res.status < 500, 'should not return 5xx, got ' + res.status);
      if (res.status === 200) {
        assertSuccess(res.body);
        assert.ok(Array.isArray(res.body.data), 'should return array of devices');
      }
    });

    it('no token returns 401', async () => {
      const res = await app.httpRequest()
        .get('/api/users/devices')
        .expect(401);
      assert.ok(res.body);
    });
  });

  describe('DELETE /api/users/devices/:deviceId', () => {
    it('remove non-existent device returns non-5xx', async () => {
      const res = await app.httpRequest()
        .delete('/api/users/devices/non_existent_device_999')
        .set('Authorization', `Bearer ${adminToken}`);
      // 设备不存在可能返回 404 或 200（幂等删除），但不应 5xx
      assert.ok(res.status < 500, 'should not return 5xx, got ' + res.status);
    });

    it('no token returns 401', async () => {
      const res = await app.httpRequest()
        .delete('/api/users/devices/any_device')
        .expect(401);
      assert.ok(res.body);
    });
  });

  describe('PUT /api/users/devices/:deviceId/push', () => {
    it('missing pushEnabled returns 422', async () => {
      const res = await app.httpRequest()
        .put('/api/users/devices/test_device/push')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({})
        .expect(422);
      assert.ok(res.body, 'should return validation error');
    });

    it('update push settings with valid data returns non-5xx', async () => {
      const res = await app.httpRequest()
        .put('/api/users/devices/test_device_push_' + Date.now() + '/push')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ pushEnabled: true });
      // 设备可能不存在返回 404，但不应 5xx
      assert.ok(res.status < 500, 'should not return 5xx, got ' + res.status);
    });

    it('no token returns 401', async () => {
      const res = await app.httpRequest()
        .put('/api/users/devices/any_device/push')
        .send({ pushEnabled: false })
        .expect(401);
      assert.ok(res.body);
    });
  });

  // ==================== 地址管理 ====================

  describe('Address /api/users/addresses', () => {
    it('add address returns 201', async () => {
      const res = await app.httpRequest()
        .post('/api/users/addresses')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          receiver: 'Test Receiver',
          phone: '13800138000',
          province: 'Guangdong',
          city: 'Shenzhen',
          district: 'Nanshan',
          address: 'Tech Park Road 1',
        })
        .expect(201);
      assertSuccess(res.body, 201);
      assert.ok(res.body.data.id);
      createdAddressId = res.body.data.id;
    });

    it('get address list', async () => {
      const res = await app.httpRequest()
        .get('/api/users/addresses')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      assertSuccess(res.body);
      assert.ok(Array.isArray(res.body.data));
    });

    it('update address success', async () => {
      if (!createdAddressId) return;
      const res = await app.httpRequest()
        .put(`/api/users/addresses/${createdAddressId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ receiver: 'Updated Receiver', phone: '13900139000' })
        .expect(200);
      assertSuccess(res.body);
    });

    it('delete address success', async () => {
      if (!createdAddressId) return;
      const res = await app.httpRequest()
        .delete(`/api/users/addresses/${createdAddressId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      assertSuccess(res.body);
    });

    it('missing required fields returns 422', async () => {
      const res = await app.httpRequest()
        .post('/api/users/addresses')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ receiver: 'Test' })
        .expect(422);
      assert.ok(res.body);
    });
  });

  // ==================== 删除用户（管理端） ====================

  describe('DELETE /api/users/:id', () => {
    it('delete user success', async () => {
      if (!createdUserId) return;
      const res = await app.httpRequest()
        .delete(`/api/users/${createdUserId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      assertSuccess(res.body);
    });

    it('delete non-existent returns 4xx', async () => {
      const res = await app.httpRequest()
        .delete('/api/users/99999999')
        .set('Authorization', `Bearer ${adminToken}`);
      assert.ok(res.status >= 400, 'should return 4xx, got ' + res.status);
    });
  });
});
