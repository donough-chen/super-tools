/**
 * OrderExpireCheck 单测 — 3 case
 *
 * 覆盖：
 *   1. subscribe 调用 service.order.cleanExpired
 *   2. cleanExpired 返回 > 0 时打 info 日志
 *   3. cleanExpired throw 时不抛错并 logger.error
 */
import OrderExpireCheck from '../../app/schedule/orderExpireCheck';

function createMockCtx(cleanExpiredReturn: any = 0) {
  return {
    app: { config: {} },
    service: {
      order: {
        cleanExpired: typeof cleanExpiredReturn === 'function'
          ? jest.fn(cleanExpiredReturn)
          : jest.fn().mockResolvedValue(cleanExpiredReturn),
      },
    },
    logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
  } as any;
}

describe('OrderExpireCheck', () => {
  it('subscribe 调用 service.order.cleanExpired', async () => {
    const ctx = createMockCtx(0);
    const task: any = new (OrderExpireCheck as any)(ctx);
    task.ctx = ctx;
    await task.subscribe();
    expect(ctx.service.order.cleanExpired).toHaveBeenCalled();
    // 0 时不打 info（避免噪声）
    expect(ctx.logger.info).not.toHaveBeenCalled();
  });

  it('cleanExpired > 0 时打 info 日志（含 affected 数）', async () => {
    const ctx = createMockCtx(3);
    const task: any = new (OrderExpireCheck as any)(ctx);
    task.ctx = ctx;
    await task.subscribe();
    expect(ctx.logger.info).toHaveBeenCalledWith(expect.stringMatching(/3/));
  });

  it('cleanExpired throw 时不抛错并 logger.error', async () => {
    const ctx = createMockCtx(() => Promise.reject(new Error('db fail')));
    const task: any = new (OrderExpireCheck as any)(ctx);
    task.ctx = ctx;
    // 不应抛出（schedule 任务即使失败也不能让 worker 崩溃）
    await expect(task.subscribe()).resolves.toBeUndefined();
    expect(ctx.logger.error).toHaveBeenCalled();
  });
});
