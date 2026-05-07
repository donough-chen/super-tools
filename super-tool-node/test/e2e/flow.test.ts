import assert from 'assert';
import { MockApplication } from 'egg-mock';
import mm from 'egg-mock';
import { TEST_CLIENT, TEST_ADMIN, assertSuccess } from '../helpers/setup';

describe('E2E Flow Tests', () => {
  let app: MockApplication;

  before(async () => {
    app = mm.app({ baseDir: process.cwd() });
    await app.ready();
  });

  after(async () => {
    await app.close();
    mm.restore();
  });

  // Scenario 1: User lifecycle
  describe('Scenario 1: register -> login -> profile -> logout', () => {
    const user = {
      username: 'e2e_user_' + Date.now(),
      email: 'e2e_' + Date.now() + '@example.com',
      password: 'E2eTest@123456',
    };
    let accessToken = '';
    let refreshToken = '';

    it('step1: register', async () => {
      const res = await app.httpRequest()
        .post('/api/auth/register')
        .send({ ...user, clientId: TEST_CLIENT.clientId })
        .expect(201);
      assertSuccess(res.body, 201);
    });

    it('step2: login', async () => {
      const res = await app.httpRequest()
        .post('/api/auth/login')
        .send({
          username: user.username,
          password: user.password,
          clientId: TEST_CLIENT.clientId,
          clientSecret: TEST_CLIENT.clientSecret,
        })
        .expect(200);
      assertSuccess(res.body);
      accessToken = res.body.data.accessToken;
      refreshToken = res.body.data.refreshToken;
      assert.ok(accessToken, 'should have accessToken');
    });

    it('step3: get profile', async () => {
      const res = await app.httpRequest()
        .get('/api/users/profile')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);
      assertSuccess(res.body);
      assert.strictEqual(res.body.data.username, user.username);
    });

    it('step4: refresh token', async () => {
      const res = await app.httpRequest()
        .post('/api/auth/refresh')
        .send({ refreshToken })
        .expect(200);
      assertSuccess(res.body);
      accessToken = res.body.data.accessToken;
    });

    it('step5: get sessions', async () => {
      const res = await app.httpRequest()
        .get('/api/auth/sessions')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);
      assertSuccess(res.body);
      assert.ok(Array.isArray(res.body.data));
    });

    it('step6: logout', async () => {
      const res = await app.httpRequest()
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);
      assertSuccess(res.body);
    });

    it('step7: token invalid after logout', async () => {
      const res = await app.httpRequest()
        .get('/api/users/profile')
        .set('Authorization', `Bearer ${accessToken}`);
      assert.ok(res.status === 401, 'token should be invalid after logout, got ' + res.status);
    });
  });

  // Scenario 2: Admin role & permission management
  describe('Scenario 2: admin create permission -> role -> assign -> cleanup', () => {
    let adminToken = '';
    let permissionId = 0;
    let roleId = 0;

    it('step1: admin login', async () => {
      const res = await app.httpRequest()
        .post('/api/auth/login')
        .send({
          username: TEST_ADMIN.username,
          password: TEST_ADMIN.password,
          clientId: TEST_CLIENT.clientId,
          clientSecret: TEST_CLIENT.clientSecret,
        })
        .expect(200);
      adminToken = res.body.data && res.body.data.accessToken;
      assert.ok(adminToken, 'admin login should succeed');
    });

    it('step2: create permission', async () => {
      const res = await app.httpRequest()
        .post('/api/admin/permissions')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'E2E_Perm_' + Date.now(),
          code: 'e2e:perm:' + Date.now(),
          type: 1,
          platform: 'web',
          sort: 100,
        })
        .expect(201);
      assertSuccess(res.body, 201);
      permissionId = res.body.data.id;
      assert.ok(permissionId, 'should return permission id');
    });

    it('step3: create role', async () => {
      const res = await app.httpRequest()
        .post('/api/admin/roles')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'E2E_Role_' + Date.now(),
          code: 'e2e_role_' + Date.now(),
          type: 2,
          status: 1,
        })
        .expect(201);
      assertSuccess(res.body, 201);
      roleId = res.body.data.id;
      assert.ok(roleId, 'should return role id');
    });

    it('step4: assign permissions to role', async () => {
      const res = await app.httpRequest()
        .put(`/api/admin/roles/${roleId}/permissions`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ permissionIds: [permissionId] })
        .expect(200);
      assertSuccess(res.body);
    });

    it('step5: verify role has permissions', async () => {
      const res = await app.httpRequest()
        .get(`/api/admin/roles/${roleId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      assertSuccess(res.body);
      assert.strictEqual(res.body.data.id, roleId);
    });

    it('step6: delete role', async () => {
      const res = await app.httpRequest()
        .delete(`/api/admin/roles/${roleId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      assertSuccess(res.body);
    });

    it('step7: delete permission', async () => {
      const res = await app.httpRequest()
        .delete(`/api/admin/permissions/${permissionId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      assertSuccess(res.body);
    });
  });

  // Scenario 3: Admin user management
  describe('Scenario 3: admin create user -> update -> delete', () => {
    let adminToken = '';
    let newUserId = 0;

    it('step1: admin login', async () => {
      const res = await app.httpRequest()
        .post('/api/auth/login')
        .send({
          username: TEST_ADMIN.username,
          password: TEST_ADMIN.password,
          clientId: TEST_CLIENT.clientId,
          clientSecret: TEST_CLIENT.clientSecret,
        })
        .expect(200);
      adminToken = res.body.data && res.body.data.accessToken;
      assert.ok(adminToken);
    });

    it('step2: create user', async () => {
      const res = await app.httpRequest()
        .post('/api/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          username: 'e2e_mgr_' + Date.now(),
          email: 'e2e_mgr_' + Date.now() + '@example.com',
          password: 'MgrTest@123456',
          nickname: 'E2E Mgr User',
        })
        .expect(201);
      assertSuccess(res.body, 201);
      newUserId = res.body.data.id;
      assert.ok(newUserId);
    });

    it('step3: get user', async () => {
      const res = await app.httpRequest()
        .get(`/api/users/${newUserId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      assertSuccess(res.body);
      assert.strictEqual(res.body.data.id, newUserId);
    });

    it('step4: update user', async () => {
      const res = await app.httpRequest()
        .put(`/api/users/${newUserId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ nickname: 'E2E Updated User', status: 1 })
        .expect(200);
      assertSuccess(res.body);
    });

    it('step5: user in list', async () => {
      const res = await app.httpRequest()
        .get('/api/users?page=1&pageSize=100')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      const found = res.body.data.list.some((u: any) => u.id === newUserId);
      assert.ok(found, 'user should be in list');
    });

    it('step6: delete user', async () => {
      const res = await app.httpRequest()
        .delete(`/api/users/${newUserId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      assertSuccess(res.body);
    });

    it('step7: user not found after delete', async () => {
      const res = await app.httpRequest()
        .get(`/api/users/${newUserId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);
      assert.ok(res.body);
    });
  });

  // Scenario 4: Address management
  describe('Scenario 4: add address -> update -> delete', () => {
    let userToken = '';
    let addressId = 0;

    it('step1: admin login', async () => {
      const res = await app.httpRequest()
        .post('/api/auth/login')
        .send({
          username: TEST_ADMIN.username,
          password: TEST_ADMIN.password,
          clientId: TEST_CLIENT.clientId,
          clientSecret: TEST_CLIENT.clientSecret,
        })
        .expect(200);
      userToken = res.body.data && res.body.data.accessToken;
      assert.ok(userToken);
    });

    it('step2: add address', async () => {
      const res = await app.httpRequest()
        .post('/api/users/addresses')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          receiver: 'E2E Receiver',
          phone: '13800138001',
          province: 'Beijing',
          city: 'Beijing',
          district: 'Chaoyang',
          address: 'Test Road 100',
        })
        .expect(201);
      assertSuccess(res.body, 201);
      addressId = res.body.data.id;
      assert.ok(addressId);
    });

    it('step3: list addresses', async () => {
      const res = await app.httpRequest()
        .get('/api/users/addresses')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);
      assertSuccess(res.body);
      const found = res.body.data.some((a: any) => a.id === addressId);
      assert.ok(found, 'address should be in list');
    });

    it('step4: update address', async () => {
      const res = await app.httpRequest()
        .put(`/api/users/addresses/${addressId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ receiver: 'E2E Updated Receiver', phone: '13900139001' })
        .expect(200);
      assertSuccess(res.body);
    });

    it('step5: delete address', async () => {
      const res = await app.httpRequest()
        .delete(`/api/users/addresses/${addressId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);
      assertSuccess(res.body);
    });
  });

  // Scenario 5: Extended profile & device management
  describe('Scenario 5: profile extra -> update profile -> register device -> list -> remove', () => {
    let userToken = '';
    const testDeviceId = 'e2e_device_' + Date.now();

    it('step1: admin login', async () => {
      const res = await app.httpRequest()
        .post('/api/auth/login')
        .send({
          username: TEST_ADMIN.username,
          password: TEST_ADMIN.password,
          clientId: TEST_CLIENT.clientId,
          clientSecret: TEST_CLIENT.clientSecret,
        })
        .expect(200);
      userToken = res.body.data && res.body.data.accessToken;
      assert.ok(userToken, 'login should succeed');
    });

    it('step2: get extended profile', async () => {
      const res = await app.httpRequest()
        .get('/api/users/profile/extra')
        .set('Authorization', `Bearer ${userToken}`);
      assert.ok(res.status < 500, 'should not return 5xx, got ' + res.status);
      if (res.status === 200) {
        assertSuccess(res.body);
        assert.ok(res.body.data, 'should have profile data');
      }
    });

    it('step3: update profile with extended fields', async () => {
      const res = await app.httpRequest()
        .put('/api/users/profile')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          nickname: 'E2E_Profile_' + Date.now(),
          bio: 'E2E test bio',
          signature: 'E2E signature',
          language: 'zh-CN',
          timezone: 'Asia/Shanghai',
        });
      assert.ok(res.status < 500, 'should not return 5xx, got ' + res.status);
    });

    it('step4: register device', async () => {
      const res = await app.httpRequest()
        .post('/api/users/devices')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          deviceId: testDeviceId,
          deviceType: 'android',
          deviceName: 'E2E Test Device',
          osVersion: 'Android 14',
          appVersion: '1.0.0',
        });
      assert.ok(res.status < 500, 'should not return 5xx, got ' + res.status);
    });

    it('step5: list devices', async () => {
      const res = await app.httpRequest()
        .get('/api/users/devices')
        .set('Authorization', `Bearer ${userToken}`);
      assert.ok(res.status < 500, 'should not return 5xx, got ' + res.status);
      if (res.status === 200) {
        assertSuccess(res.body);
        assert.ok(Array.isArray(res.body.data), 'should return device array');
      }
    });

    it('step6: update push settings', async () => {
      const res = await app.httpRequest()
        .put(`/api/users/devices/${testDeviceId}/push`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ pushEnabled: true });
      assert.ok(res.status < 500, 'should not return 5xx, got ' + res.status);
    });

    it('step7: remove device', async () => {
      const res = await app.httpRequest()
        .delete(`/api/users/devices/${testDeviceId}`)
        .set('Authorization', `Bearer ${userToken}`);
      assert.ok(res.status < 500, 'should not return 5xx, got ' + res.status);
    });
  });

  // Scenario 6: Bind status check (smoke test for binding endpoints)
  describe('Scenario 6: check bind status -> attempt bind operations', () => {
    let userToken = '';

    it('step1: admin login', async () => {
      const res = await app.httpRequest()
        .post('/api/auth/login')
        .send({
          username: TEST_ADMIN.username,
          password: TEST_ADMIN.password,
          clientId: TEST_CLIENT.clientId,
          clientSecret: TEST_CLIENT.clientSecret,
        })
        .expect(200);
      userToken = res.body.data && res.body.data.accessToken;
      assert.ok(userToken, 'login should succeed');
    });

    it('step2: get bind status', async () => {
      const res = await app.httpRequest()
        .get('/api/auth/bind-status')
        .set('Authorization', `Bearer ${userToken}`);
      assert.ok(res.status < 500, 'should not return 5xx, got ' + res.status);
      if (res.status === 200) {
        assertSuccess(res.body);
        assert.ok(res.body.data !== undefined, 'should return bind status');
      }
    });

    it('step3: attempt unbind (may fail if nothing bound)', async () => {
      const res = await app.httpRequest()
        .post('/api/auth/unbind')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ type: 'wechat', platform: 'miniprogram' });
      // 预期 4xx（未绑定）或 200（成功），不应 5xx
      assert.ok(res.status < 500, 'should not return 5xx, got ' + res.status);
    });

    it('step4: bind phone with invalid code (validation smoke)', async () => {
      const res = await app.httpRequest()
        .post('/api/auth/bind/phone')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ phone: '13800139999', code: '000000' });
      // 预期 4xx（无效验证码），不应 5xx
      assert.ok(res.status < 500, 'should not return 5xx, got ' + res.status);
    });

    it('step5: bind email with invalid code (validation smoke)', async () => {
      const res = await app.httpRequest()
        .post('/api/auth/bind/email')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ email: 'e2e_bind_' + Date.now() + '@example.com', code: '000000' });
      // 预期 4xx（无效验证码），不应 5xx
      assert.ok(res.status < 500, 'should not return 5xx, got ' + res.status);
    });
  });
});
