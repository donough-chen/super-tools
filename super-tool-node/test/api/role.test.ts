import assert from 'assert';
import { MockApplication } from 'egg-mock';
import mm from 'egg-mock';
import { TEST_CLIENT, TEST_ADMIN, assertSuccess, assertPaginated } from '../helpers/setup';

describe('Role API /api/admin/roles', () => {
  let app: MockApplication;
  let adminToken = '';
  let roleId = 0;

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

  describe('GET /api/admin/roles', () => {
    it('get role list returns paginated data', async () => {
      const res = await app.httpRequest()
        .get('/api/admin/roles')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      assertPaginated(res.body);
    });

    it('search by keyword', async () => {
      const res = await app.httpRequest()
        .get('/api/admin/roles?keyword=admin&page=1&pageSize=10')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      assertPaginated(res.body);
    });

    it('no token returns 401', async () => {
      const res = await app.httpRequest()
        .get('/api/admin/roles')
        .expect(401);
      assert.ok(res.body);
    });
  });

  describe('POST /api/admin/roles', () => {
    it('create role returns 201', async () => {
      const res = await app.httpRequest()
        .post('/api/admin/roles')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'TestRole_' + Date.now(),
          code: 'test_role_' + Date.now(),
          type: 2,
          description: 'test role',
          status: 1,
        })
        .expect(201);
      assertSuccess(res.body, 201);
      assert.ok(res.body.data.id, 'should return id');
      roleId = res.body.data.id;
    });

    it('missing name returns 422', async () => {
      const res = await app.httpRequest()
        .post('/api/admin/roles')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ code: 'test_code' })
        .expect(422);
      assert.ok(res.body);
    });

    it('missing code returns 422', async () => {
      const res = await app.httpRequest()
        .post('/api/admin/roles')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'TestRole' })
        .expect(422);
      assert.ok(res.body);
    });
  });

  describe('GET /api/admin/roles/:id', () => {
    it('get role detail', async () => {
      assert.ok(roleId, 'need to create role first');
      const res = await app.httpRequest()
        .get(`/api/admin/roles/${roleId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      assertSuccess(res.body);
      assert.strictEqual(res.body.data.id, roleId);
    });

    it('not found returns 4xx', async () => {
      const res = await app.httpRequest()
        .get('/api/admin/roles/99999999')
        .set('Authorization', `Bearer ${adminToken}`);
      assert.ok(res.status >= 400, 'should return 4xx, got ' + res.status);
    });
  });

  describe('PUT /api/admin/roles/:id', () => {
    it('update role success', async () => {
      assert.ok(roleId, 'need to create role first');
      const res = await app.httpRequest()
        .put(`/api/admin/roles/${roleId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ description: 'updated description', status: 1 })
        .expect(200);
      assertSuccess(res.body);
    });
  });

  describe('PUT /api/admin/roles/:id/permissions', () => {
    it('assign empty permissions', async () => {
      assert.ok(roleId, 'need to create role first');
      const res = await app.httpRequest()
        .put(`/api/admin/roles/${roleId}/permissions`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ permissionIds: [] })
        .expect(200);
      assertSuccess(res.body);
    });

    it('invalid permissionIds returns 422', async () => {
      assert.ok(roleId, 'need to create role first');
      const res = await app.httpRequest()
        .put(`/api/admin/roles/${roleId}/permissions`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ permissionIds: 'not-an-array' })
        .expect(422);
      assert.ok(res.body);
    });
  });

  describe('DELETE /api/admin/roles/:id', () => {
    it('delete role success', async () => {
      if (!roleId) return;
      const res = await app.httpRequest()
        .delete(`/api/admin/roles/${roleId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      assertSuccess(res.body);
    });

    it('delete non-existent returns 4xx', async () => {
      const res = await app.httpRequest()
        .delete('/api/admin/roles/99999999')
        .set('Authorization', `Bearer ${adminToken}`);
      assert.ok(res.status >= 400, 'should return 4xx, got ' + res.status);
    });
  });
});
