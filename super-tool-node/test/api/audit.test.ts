import assert from 'assert';
import { MockApplication } from 'egg-mock';
import mm from 'egg-mock';

/**
 * Audit Service 契约测试（service.audit.log）
 *
 * 覆盖 4 个分支：
 *   1. 成功路径：log({status:1}) → audit_logs 真实写入 + 字段完整
 *   2. 失败路径：log({status:0, failReason}) → status=0 + failReason 入库
 *   3. before/after 分别只传：null 字段保持 null（不是 undefined）
 *   4. AuditLog.create 抛异常时 service.log 内部吞异常 + logger.warn
 *
 * 风格：与 rbac-cache.test.ts 一致，真实 DB 写入 + 直接查回验证。
 */
describe('Audit Service contract', () => {
  let app: MockApplication;
  const insertedIds: number[] = [];

  before(async () => {
    app = mm.app({ baseDir: process.cwd() });
    await app.ready();
  });

  after(async () => {
    // 清理本测试产生的所有审计记录
    if (insertedIds.length > 0) {
      await app.model.AuditLog.destroy({ where: { id: insertedIds } });
    }
    await app.close();
    mm.restore();
  });

  // ==================== Case 1: 成功路径写入完整字段 ====================

  it('成功路径写入完整字段（含 ctx 自动注入字段）', async () => {
    const ctx = app.createAnonymousContext();
    // 模拟 ctx.state.user / requestStartTime（中间件自动注入的字段）
    (ctx.state as any).user = { id: 999, username: 'test-admin' };
    (ctx.state as any).requestStartTime = Date.now() - 50;

    await ctx.service.audit.log({
      module: 'tool',
      action: 'delete',
      bizType: 'tool',
      bizId: 5,
      beforeData: { name: 'foo', status: 1 },
      description: '删除 tool #5',
      status: 1,
    });

    // 查询最新一条 module=tool action=delete bizId=5 由 test-admin 写入的记录
    const latest = await app.model.AuditLog.findOne({
      where: { module: 'tool', action: 'delete', bizId: '5', userId: 999 },
      order: [['id', 'DESC']],
    });
    assert.ok(latest, '应能找到刚写入的审计记录');
    insertedIds.push((latest as any).id);

    const row: any = (latest as any).toJSON();
    assert.strictEqual(row.module, 'tool');
    assert.strictEqual(row.action, 'delete');
    assert.strictEqual(row.userId, 999);
    assert.strictEqual(row.username, 'test-admin');
    assert.strictEqual(row.bizId, '5');
    assert.strictEqual(row.status, 1);
    assert.deepStrictEqual(row.beforeData, { name: 'foo', status: 1 });
    assert.strictEqual(row.afterData, null);
    assert.ok(typeof row.costTime === 'number' && row.costTime >= 0,
      'costTime 应为 >=0 的数字');
  });

  // ==================== Case 2: 失败路径写入 status=0 + failReason ====================

  it('失败路径写入 status=0 + failReason', async () => {
    const ctx = app.createAnonymousContext();
    (ctx.state as any).user = { id: 999, username: 'test-admin' };

    await ctx.service.audit.log({
      module: 'tool',
      action: 'delete',
      bizId: 99999,
      status: 0,
      failReason: 'permission denied (test)',
      description: '尝试删除 tool #99999',
    });

    const latest = await app.model.AuditLog.findOne({
      where: { module: 'tool', action: 'delete', bizId: '99999', userId: 999, status: 0 },
      order: [['id', 'DESC']],
    });
    assert.ok(latest, '失败记录也应能写入');
    insertedIds.push((latest as any).id);

    const row: any = (latest as any).toJSON();
    assert.strictEqual(row.status, 0);
    assert.strictEqual(row.failReason, 'permission denied (test)');
  });

  // ==================== Case 3: before/after 仅传时另一字段为 null ====================

  it('beforeData 仅传时 afterData 为 null，反之亦然', async () => {
    const ctx = app.createAnonymousContext();
    (ctx.state as any).user = { id: 999, username: 'test-admin' };

    await ctx.service.audit.log({
      module: 'role',
      action: 'create',
      bizId: 'before-only',
      afterData: { v: 'only-after' },  // 仅传 after
    });
    await ctx.service.audit.log({
      module: 'role',
      action: 'delete',
      bizId: 'after-only',
      beforeData: { v: 'only-before' },  // 仅传 before
    });

    const r1 = await app.model.AuditLog.findOne({
      where: { module: 'role', action: 'create', bizId: 'before-only', userId: 999 },
      order: [['id', 'DESC']],
    });
    const r2 = await app.model.AuditLog.findOne({
      where: { module: 'role', action: 'delete', bizId: 'after-only', userId: 999 },
      order: [['id', 'DESC']],
    });
    assert.ok(r1 && r2);
    insertedIds.push((r1 as any).id, (r2 as any).id);

    const j1: any = (r1 as any).toJSON();
    const j2: any = (r2 as any).toJSON();
    assert.strictEqual(j1.beforeData, null, 'r1 仅传 after，before 应为 null');
    assert.deepStrictEqual(j1.afterData, { v: 'only-after' });
    assert.deepStrictEqual(j2.beforeData, { v: 'only-before' });
    assert.strictEqual(j2.afterData, null, 'r2 仅传 before，after 应为 null');
  });

  // ==================== Case 4: DB 错误时不抛 + logger.warn ====================

  it('AuditLog.create 抛异常时 service.log 内部吞异常 + logger.warn', async () => {
    const ctx = app.createAnonymousContext();
    (ctx.state as any).user = { id: 999, username: 'test-admin' };

    let warnedCount = 0;
    let warnedMessage = '';
    // mock create 抛错
    mm(app.model.AuditLog, 'create', () => {
      return Promise.reject(new Error('DB connection lost (mocked)'));
    });
    // mock logger.warn 计数
    mm(ctx.logger, 'warn', function(this: any, ...args: any[]) {
      warnedCount += 1;
      warnedMessage = args.map(String).join(' ');
    });

    // 关键：不应抛
    let threw = false;
    try {
      await ctx.service.audit.log({ module: 'x', action: 'a' });
    } catch {
      threw = true;
    }

    assert.strictEqual(threw, false, 'service.audit.log 不应抛异常');
    assert.ok(warnedCount >= 1, 'logger.warn 应被至少调用 1 次');
    assert.ok(warnedMessage.includes('audit') || warnedMessage.includes('DB connection lost'),
      'warn 消息应包含审计相关或错误内容');

    mm.restore();
  });
});
