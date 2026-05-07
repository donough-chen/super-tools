import assert from 'assert';
import { MockApplication } from 'egg-mock';
import mm from 'egg-mock';
import { TEST_CLIENT, TEST_ADMIN, assertSuccess } from '../helpers/setup';

describe('Permission API /api/admin/permissions', () => {
  let app: MockApplication;
  let adminToken = '';
  let permissionId = 0;
  let childPermissionId = 0;

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

  describe('GET /api/admin/permissions/tree', () => {
    it('get permission tree returns array', async () => {
      const res = await app.httpRequest()
        .get('/api/admin/permissions/tree')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      assertSuccess(res.body);
      assert.ok(Array.isArray(res.body.data), 'should return array');
    });

    it('filter by platform', async () => {
      const res = await app.httpRequest()
        .get('/api/admin/permissions/tree?platform=web')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      assertSuccess(res.body);
      assert.ok(Array.isArray(res.body.data));
    });

    it('no token returns 401', async () => {
      const res = await app.httpRequest()
        .get('/api/admin/permissions/tree')
        .expect(401);
      assert.ok(res.body);
    });
  });

  describe('POST /api/admin/permissions', () => {
    it('create permission returns 201', async () => {
      const res = await app.httpRequest()
        .post('/api/admin/permissions')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'TestPerm_' + Date.now(),
          code: 'test:perm:' + Date.now(),
          type: 1,
          platform: 'web',
          sort: 99,
        })
        .expect(201);
      assertSuccess(res.body, 201);
      assert.ok(res.body.data.id, 'should return id');
      permissionId = res.body.data.id;
    });

    it('create child permission', async () => {
      if (!permissionId) return;
      const res = await app.httpRequest()
        .post('/api/admin/permissions')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'ChildPerm_' + Date.now(),
          code: 'test:perm:child:' + Date.now(),
          type: 2,
          parentId: permissionId,
          platform: 'web',
        })
        .expect(201);
      assertSuccess(res.body, 201);
      childPermissionId = res.body.data.id;
    });

    it('missing name returns 422', async () => {
      const res = await app.httpRequest()
        .post('/api/admin/permissions')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ code: 'test:perm:noname' })
        .expect(422);
      assert.ok(res.body);
    });

    it('missing code returns 422', async () => {
      const res = await app.httpRequest()
        .post('/api/admin/permissions')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'NoCodePerm' })
        .expect(422);
      assert.ok(res.body);
    });
  });

  describe('GET /api/admin/permissions/:id', () => {
    it('get permission detail', async () => {
      assert.ok(permissionId, 'need to create permission first');
      const res = await app.httpRequest()
        .get(`/api/admin/permissions/${permissionId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      assertSuccess(res.body);
      assert.strictEqual(res.body.data.id, permissionId);
    });

    it('not found returns 4xx', async () => {
      const res = await app.httpRequest()
        .get('/api/admin/permissions/99999999')
        .set('Authorization', `Bearer ${adminToken}`);
      assert.ok(res.status >= 400, 'should return 4xx, got ' + res.status);
    });
  });

  describe('PUT /api/admin/permissions/:id', () => {
    it('update permission success', async () => {
      assert.ok(permissionId, 'need to create permission first');
      const res = await app.httpRequest()
        .put(`/api/admin/permissions/${permissionId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ sort: 50 })
        .expect(200);
      assertSuccess(res.body);
    });
  });

  describe('DELETE /api/admin/permissions/:id', () => {
    it('delete child permission first', async () => {
      if (!childPermissionId) return;
      const res = await app.httpRequest()
        .delete(`/api/admin/permissions/${childPermissionId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      assertSuccess(res.body);
    });

    it('delete permission success', async () => {
      if (!permissionId) return;
      const res = await app.httpRequest()
        .delete(`/api/admin/permissions/${permissionId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      assertSuccess(res.body);
    });

    it('delete non-existent returns 4xx', async () => {
      const res = await app.httpRequest()
        .delete('/api/admin/permissions/99999999')
        .set('Authorization', `Bearer ${adminToken}`);
      assert.ok(res.status >= 400, 'should return 4xx, got ' + res.status);
    });
  });
});
