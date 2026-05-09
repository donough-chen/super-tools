import assert from 'assert';
import { MockApplication } from 'egg-mock';
import mm from 'egg-mock';
import { TEST_CLIENT, TEST_ADMIN } from '../helpers/setup';

/**
 * RBAC 权限缓存契约测试（PermissionService.getUserPermissionCodes）
 *
 * 覆盖 4 个分支：
 *   1. 首次调用：缓存未命中 → 回源 DB → 写入 redis（key=user:permissions:<userId>, TTL=3600）
 *   2. 二次调用：缓存命中 → 不再访问 DB，直接返回 redis 中的内容
 *   3. 缓存失效：role.assignPermissions 调用后，user:permissions:* 应被清空
 *   4. 缓存容错：redis 中的值被损坏（非 JSON），不应抛错，应回源 DB 重建
 *
 * 注意：本测试套件依赖真实 redis（与项目 e2e 风格一致），不做 ioredis mock。
 */
describe('RBAC permission cache contract', () => {
  let app: MockApplication;
  // egg-redis 注入的实例；MockApplication 类型未携带 augmentation，故本地以 any 拿一次
  let redis: any;
  let adminUserId = 0;

  before(async () => {
    app = mm.app({ baseDir: process.cwd() });
    await app.ready();
    redis = (app as any).redis;
    if (!redis) {
      throw new Error('app.redis 不存在，请确认 egg-redis 已启用');
    }

    // 用 admin 登录拿 userId（admin 是 super_admin，但 service 层不会短路，仍会走完整缓存逻辑）
    const loginRes = await app.httpRequest()
      .post('/api/auth/login')
      .send({
        username: TEST_ADMIN.username,
        password: TEST_ADMIN.password,
        clientId: TEST_CLIENT.clientId,
        clientSecret: TEST_CLIENT.clientSecret,
      });
    const adminToken = loginRes.body.data?.accessToken;
    if (!adminToken) {
      throw new Error('admin 登录失败: ' + JSON.stringify(loginRes.body));
    }

    const meRes = await app.httpRequest()
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    // /api/auth/me 返回结构：{ data: { user: { id, ... }, roles, permissions, isSuperAdmin } }
    adminUserId = meRes.body.data?.user?.id;
    if (!adminUserId) {
      throw new Error('未拿到 admin userId: ' + JSON.stringify(meRes.body));
    }
  });

  after(async () => {
    await app.close();
    mm.restore();
  });

  // 每个用例前清掉目标 key，避免互相污染
  beforeEach(async () => {
    await redis.del(`user:permissions:${adminUserId}`);
  });

  // ==================== 分支 1：缓存未命中 → 回源 DB → 写缓存 ====================

  it('首次调用：缓存未命中应回源 DB 并写入 redis（TTL≈3600）', async () => {
    // 前置确认 key 不存在
    const before = await redis.get(`user:permissions:${adminUserId}`);
    assert.strictEqual(before, null, '前置：key 应不存在');

    const ctx = app.createAnonymousContext();
    const codes = await ctx.service.permission.getUserPermissionCodes(adminUserId);
    assert.ok(Array.isArray(codes), '返回应为字符串数组');

    // 写缓存校验
    const cached = await redis.get(`user:permissions:${adminUserId}`);
    assert.ok(cached, '调用后 redis 应写入缓存');
    const parsed = JSON.parse(cached as string);
    assert.deepStrictEqual(parsed, codes, '缓存内容应等于返回值');

    // TTL 校验：刚写入应在 (3590, 3600] 之间
    const ttl = await redis.ttl(`user:permissions:${adminUserId}`);
    assert.ok(ttl > 3590 && ttl <= 3600, `TTL 应≈3600，实际=${ttl}`);
  });

  // ==================== 分支 2：缓存命中 ====================

  it('二次调用：缓存命中应直接返回缓存内容（不依赖 DB）', async () => {
    const ctx = app.createAnonymousContext();

    // 第一次：建立缓存
    const first = await ctx.service.permission.getUserPermissionCodes(adminUserId);

    // 手动改写缓存为"哨兵值"，下一次调用如果命中缓存就一定返回这个哨兵
    const sentinel = [ '__cache_hit_sentinel__' ];
    await redis.setex(
      `user:permissions:${adminUserId}`,
      3600,
      JSON.stringify(sentinel),
    );

    // 第二次：必须命中缓存返回哨兵，而不是回源 DB
    const second = await ctx.service.permission.getUserPermissionCodes(adminUserId);
    assert.deepStrictEqual(
      second,
      sentinel,
      '二次调用应返回缓存内容（哨兵），实际返回回源结果说明缓存未命中',
    );

    // first 与 second 应不相等（哨兵不会出现在真实权限码里）
    assert.notDeepStrictEqual(first, second);
  });

  // ==================== 分支 3：失效 — role.assignPermissions 后缓存被清 ====================

  it('role.assignPermissions 触发后 user:permissions:* 应被清空', async () => {
    const ctx = app.createAnonymousContext();

    // 先建立缓存
    await ctx.service.permission.getUserPermissionCodes(adminUserId);
    const before = await redis.get(`user:permissions:${adminUserId}`);
    assert.ok(before, '前置：缓存应存在');

    // 找一个非系统的角色，避免影响系统角色矩阵；找不到就用首个角色
    const roles = await ctx.model.Role.findAll({ limit: 1, order: [[ 'id', 'ASC' ]] });
    assert.ok(roles.length > 0, '前置：至少需要 1 个角色');
    const roleId = (roles[0] as any).id;

    // 取该角色当前的 permission ids，原样回写（等价 no-op，但会触发 clearCache）
    const existing = await ctx.model.RolePermission.findAll({ where: { roleId } });
    const permIds = existing.map((rp: any) => rp.permissionId);

    await ctx.service.role.assignPermissions(roleId, permIds);

    // 缓存应被清掉
    const after = await redis.get(`user:permissions:${adminUserId}`);
    assert.strictEqual(after, null, 'assignPermissions 后缓存应被清空');
  });

  // ==================== 分支 4：缓存容错 — 损坏数据 ====================

  it('缓存中存在损坏（非 JSON）数据时应静默回源，不抛错', async () => {
    // 主动塞入非 JSON 字符串
    await redis.setex(
      `user:permissions:${adminUserId}`,
      3600,
      'this-is-not-valid-json-{[',
    );

    const ctx = app.createAnonymousContext();

    // 不应抛错
    let codes: string[] = [];
    let thrown: any = null;
    try {
      codes = await ctx.service.permission.getUserPermissionCodes(adminUserId);
    } catch (e) {
      thrown = e;
    }
    assert.strictEqual(thrown, null, '损坏缓存不应导致 getUserPermissionCodes 抛错');
    assert.ok(Array.isArray(codes), '应回源 DB 返回数组');

    // 回源后应重新写入合法 JSON
    const rewritten = await redis.get(`user:permissions:${adminUserId}`);
    assert.ok(rewritten, '回源后应重新写入缓存');
    // 不应再是损坏值
    let parsed: any = null;
    assert.doesNotThrow(() => { parsed = JSON.parse(rewritten as string); }, '回写后应为合法 JSON');
    assert.ok(Array.isArray(parsed), '回写后内容应为数组');
  });
});
