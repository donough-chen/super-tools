import assert from 'assert';
import { MockApplication } from 'egg-mock';
import mm from 'egg-mock';
import { TEST_CLIENT, TEST_ADMIN, assertSuccess } from '../helpers/setup';

describe('Dashboard /api/admin/dashboard', () => {
  let app: MockApplication;
  let adminToken = '';

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

  describe('GET /api/admin/dashboard', () => {
    it('get dashboard stats', async () => {
      const res = await app.httpRequest()
        .get('/api/admin/dashboard')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      assertSuccess(res.body);
      const data = res.body.data;
      assert.ok(typeof data.userCount === 'number', 'should have userCount');
      assert.ok(typeof data.todayLoginCount === 'number', 'should have todayLoginCount');
      assert.ok(typeof data.activeSessionCount === 'number', 'should have activeSessionCount');
      assert.ok(typeof data.roleCount === 'number', 'should have roleCount');
    });

    it('userCount should be >= 0', async () => {
      const res = await app.httpRequest()
        .get('/api/admin/dashboard')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      assertSuccess(res.body);
      assert.ok(res.body.data.userCount >= 0);
    });

    it('no token returns 401', async () => {
      const res = await app.httpRequest()
        .get('/api/admin/dashboard')
        .expect(401);
      assert.ok(res.body);
    });

    it('invalid token returns 401', async () => {
      const res = await app.httpRequest()
        .get('/api/admin/dashboard')
        .set('Authorization', 'Bearer invalid.token.here')
        .expect(401);
      assert.ok(res.body);
    });
  });
});
