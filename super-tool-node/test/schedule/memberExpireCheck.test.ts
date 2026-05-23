import MemberExpireCheck from '../../app/schedule/memberExpireCheck';

function createMockCtx() {
  const ctx: any = {
    model: {
      UserMember: { findAll: jest.fn().mockResolvedValue([]) },
      PaidPlan: { findOne: jest.fn() },
    },
    service: {
      notification: { core: { send: jest.fn().mockResolvedValue({}) } },
    },
    logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
  };
  return ctx;
}

function createTask(ctx: any) {
  // egg Subscription 父类构造时会读 ctx.app.config / ctx.service，先补齐占位
  ctx.app = ctx.app || { config: {} };
  const task: any = new (MemberExpireCheck as any)(ctx);
  // 保险起见显式覆盖
  task.ctx = ctx;
  return task;
}

describe('MemberExpireCheck', () => {
  beforeEach(() => jest.clearAllMocks());

  it('subscribe 调用三次扫描', async () => {
    const ctx = createMockCtx();
    const task = createTask(ctx);
    const spy7 = jest.spyOn(task, '_scanExpireSoon').mockResolvedValue(undefined);
    const spyExp = jest.spyOn(task, '_scanExpired').mockResolvedValue(undefined);

    await task.subscribe();
    expect(spy7).toHaveBeenCalledWith(7);
    expect(spy7).toHaveBeenCalledWith(1);
    expect(spyExp).toHaveBeenCalled();
  });

  it('_scanExpireSoon: 找到目标用户 → 触发 send 含正确幂等键', async () => {
    const ctx = createMockCtx();
    const task = createTask(ctx);
    const future = new Date(Date.now() + 7 * 86400000);
    ctx.model.UserMember.findAll.mockResolvedValue([{
      toJSON: () => ({ userId: 5, paidPlanCode: 'monthly', paidExpireAt: future }),
    }]);
    ctx.model.PaidPlan.findOne.mockResolvedValue({ name: '月度会员' });

    await task._scanExpireSoon(7);

    expect(ctx.service.notification.core.send).toHaveBeenCalledWith(expect.objectContaining({
      typeCode: 'BUSINESS_MEMBER_EXPIRE_SOON',
      userId: 5,
      variables: expect.objectContaining({ stage: '7d', daysLeft: 7, planName: '月度会员' }),
      idempotentKey: expect.stringMatching(/^member_expire_5_\d{4}-\d{2}-\d{2}_7d$/),
    }));
  });

  it('_scanExpired: 找到过期用户 → update is_paid=0 + 通知', async () => {
    const ctx = createMockCtx();
    const task = createTask(ctx);
    const expired = new Date(Date.now() - 12 * 3600 * 1000);
    const updateMock = jest.fn();
    ctx.model.UserMember.findAll.mockResolvedValue([{
      toJSON: () => ({ userId: 5, paidPlanCode: 'monthly', paidExpireAt: expired }),
      update: updateMock,
    }]);

    await task._scanExpired();

    expect(updateMock).toHaveBeenCalledWith({ isPaid: 0 });
    expect(ctx.service.notification.core.send).toHaveBeenCalledWith(expect.objectContaining({
      typeCode: 'BUSINESS_MEMBER_EXPIRED',
    }));
  });

  it('PaidPlan 取不到 → planName 降级为 paidPlanCode', async () => {
    const ctx = createMockCtx();
    const task = createTask(ctx);
    const future = new Date(Date.now() + 7 * 86400000);
    ctx.model.UserMember.findAll.mockResolvedValue([{
      toJSON: () => ({ userId: 5, paidPlanCode: 'monthly', paidExpireAt: future }),
    }]);
    ctx.model.PaidPlan.findOne.mockResolvedValue(null);

    await task._scanExpireSoon(7);
    expect(ctx.service.notification.core.send).toHaveBeenCalledWith(expect.objectContaining({
      variables: expect.objectContaining({ planName: 'monthly' }),
    }));
  });
});
