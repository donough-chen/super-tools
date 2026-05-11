import { app } from 'egg-mock/bootstrap';
import * as assert from 'assert';

describe('Feedback Service contract', () => {
  let ctx: any;

  beforeEach(() => {
    ctx = app.mockContext({
      ip: '127.0.0.1',
      state: { user: { id: 1, username: 'admin' } },
    });
  });

  afterEach(() => app.mockRestore());

  it('1. 匿名用户 create 写入 userId=null', async () => {
    const fb = await ctx.service.feedback.create({
      type: 'bug',
      content: 'test bug content for case 1',
      contact: 'test@test.com',
      platform: 'tool-box',
    });
    assert.strictEqual((fb as any).userId, null);
    assert.strictEqual((fb as any).status, 0);
    assert.strictEqual((fb as any).type, 'bug');
    await ctx.model.Feedback.destroy({
      where: { id: (fb as any).id }, force: true,
    });
  });

  it('2. 登录用户 create 写入 userId=actual', async () => {
    const fb = await ctx.service.feedback.create({
      userId: 123,
      type: 'suggestion',
      content: 'test suggestion content for case 2',
    });
    assert.strictEqual(Number((fb as any).userId), 123);
    assert.strictEqual((fb as any).type, 'suggestion');
    await ctx.model.Feedback.destroy({
      where: { id: (fb as any).id }, force: true,
    });
  });

  it('3. list 按 status 过滤 + 软删条目不返回', async () => {
    const marker = `list-case-${Date.now()}`;
    const fb1 = await ctx.service.feedback.create({
      type: 'other', content: `a ${marker}`,
    });
    const fb2 = await ctx.service.feedback.create({
      type: 'other', content: `b ${marker}`,
    });
    await fb2.destroy();   // 软删

    const result = await ctx.service.feedback.list({
      status: 0, pageSize: 100, keyword: marker,
    });
    const ids = result.rows.map((r: any) => r.id);
    assert.ok(ids.includes((fb1 as any).id),
      'fb1 should be in list');
    assert.ok(!ids.includes((fb2 as any).id),
      'fb2 (soft-deleted) should NOT be in list');

    await ctx.model.Feedback.destroy({
      where: { id: [(fb1 as any).id, (fb2 as any).id] },
      force: true,
    });
  });

  it('4. reply 状态 0→2 + 写 reply_* 三字段', async () => {
    const fb = await ctx.service.feedback.create({
      type: 'bug',
      content: 'reply test content case 4',
    });
    const replied = await ctx.service.feedback.reply(
      (fb as any).id, '已修复', 1,
    );
    assert.strictEqual((replied as any).status, 2);
    assert.strictEqual((replied as any).replyContent, '已修复');
    assert.strictEqual(Number((replied as any).replyUserId), 1);
    assert.ok((replied as any).repliedAt, 'repliedAt should be set');
    await ctx.model.Feedback.destroy({
      where: { id: (fb as any).id }, force: true,
    });
  });

  it('5. reply 状态 2 时再次 reply 抛 409', async () => {
    const fb = await ctx.service.feedback.create({
      type: 'bug',
      content: 'second reply test case 5',
    });
    await ctx.service.feedback.reply((fb as any).id, 'first reply', 1);

    let err: any;
    try {
      await ctx.service.feedback.reply((fb as any).id, 'second reply', 1);
    } catch (e) { err = e; }

    assert.ok(err, 'should throw');
    assert.strictEqual(err.status, 409);
    await ctx.model.Feedback.destroy({
      where: { id: (fb as any).id }, force: true,
    });
  });

  it('6. update transition：0→1 OK，2→3 抛 422', async () => {
    const fb = await ctx.service.feedback.create({
      type: 'other',
      content: 'update transition test case 6',
    });

    // 0 → 1 OK
    await ctx.service.feedback.update((fb as any).id, { status: 1 });
    let updated: any = await ctx.model.Feedback.findByPk((fb as any).id);
    assert.strictEqual(updated.status, 1);

    // 1 → 2 (走 reply)
    await ctx.service.feedback.reply((fb as any).id, 'r', 1);

    // 2 → 3 禁止
    let err: any;
    try {
      await ctx.service.feedback.update((fb as any).id, { status: 3 });
    } catch (e) { err = e; }
    assert.ok(err, 'should throw 422');
    assert.strictEqual(err.status, 422);

    await ctx.model.Feedback.destroy({
      where: { id: (fb as any).id }, force: true,
    });
  });
});
