/**
 * TaskRewardResendSchedule 单测（B10 / spec §2.3-#12）
 *
 * 覆盖：
 *   1. 扫描 batch limit=100 + retryCount<5 + nextRetryAt 过滤条件
 *   2. 成功路径：调 member.addPoints + comp.update(status='rewarded')
 *   3. 失败路径（重试中）：retryCount+1 + nextRetryAt + errorMsg, status 不变
 *   4. 失败路径（达到上限 5）：status='failed' + [ALERT] critical 日志
 *   5. 指数退避：nextRetryAt 间隔 = 2^(retryCount+1) 分钟
 *   6. 单条失败不影响其他条目（多条混合处理）
 */

import TaskRewardResendSchedule from '../../app/schedule/task_reward_resend';

function createMockCtx() {
  const baseCtx: any = {
    model: {
      TaskCompletionLog: {
        findAll: jest.fn(),
      },
      transaction: jest.fn(async (fn: any) => fn({ /* 简化的事务对象 */ })),
    },
    service: {
      member: {
        addPoints: jest.fn(),
      },
    },
    logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
  };
  return baseCtx;
}

function createTask(ctx: any) {
  // 绕过 Subscription 构造器（BaseContextClass 需要 ctx.app.config，单测无完整 app）
  const task: any = Object.create(TaskRewardResendSchedule.prototype);
  task.ctx = ctx;
  return task;
}

function makeComp(overrides: Partial<{
  id: number;
  userId: number;
  taskCode: string;
  rewardPoints: number;
  rewardGrowth: number;
  retryCount: number;
}> = {}) {
  const update = jest.fn().mockResolvedValue(undefined);
  const comp = {
    id: 1,
    userId: 100,
    taskCode: 'daily_sign',
    rewardPoints: 10,
    rewardGrowth: 5,
    retryCount: 0,
    update,
    ...overrides,
  };
  return comp;
}

describe('TaskRewardResendSchedule', () => {
  beforeEach(() => jest.clearAllMocks());

  it('case1: 扫描条件 — limit=100 + retryCount<5 + nextRetryAt 过滤', async () => {
    const ctx = createMockCtx();
    ctx.model.TaskCompletionLog.findAll.mockResolvedValue([]);
    const task = createTask(ctx);

    await task.subscribe();

    expect(ctx.model.TaskCompletionLog.findAll).toHaveBeenCalledTimes(1);
    const callArg = ctx.model.TaskCompletionLog.findAll.mock.calls[0][0];
    expect(callArg.limit).toBe(100);
    expect(callArg.where.status).toBe('pending');
    // retryCount: { [Op.lt]: 5 }
    expect(callArg.where.retryCount).toBeDefined();
    // nextRetryAt 过滤 — Op.or 是 Symbol 键，验证其 value 为 [{nextRetryAt:null},{nextRetryAt:{<=now}}]
    const opOr: any = Object.getOwnPropertySymbols(callArg.where)[0];
    expect(opOr).toBeDefined();
    const orArr = callArg.where[opOr];
    expect(Array.isArray(orArr)).toBe(true);
    expect(orArr.length).toBe(2);
    expect(orArr[0].nextRetryAt).toBeNull();
    expect(orArr[1].nextRetryAt).toBeDefined();
  });

  it('case2: 成功路径 — addPoints + comp.update(status=rewarded)', async () => {
    const ctx = createMockCtx();
    const comp = makeComp();
    ctx.model.TaskCompletionLog.findAll.mockResolvedValue([comp]);
    ctx.service.member.addPoints.mockResolvedValue({ logId: 999 });

    const task = createTask(ctx);
    await task.subscribe();

    expect(ctx.service.member.addPoints).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 100,
        points: 10,
        growthDelta: 5,
        source: 'task_reward',
        bizType: 'task',
        bizId: 'daily_sign',
        applyMultiplier: false,
      }),
    );
    expect(comp.update).toHaveBeenCalledWith(
      { status: 'rewarded', pointsLogId: 999 },
      expect.any(Object),
    );
    expect(ctx.logger.info).toHaveBeenCalledWith(expect.stringMatching(/ok user=100 task=daily_sign/));
  });

  it('case3: 失败但未到上限 — retryCount+1, status 不变, error 日志（无 ALERT）', async () => {
    const ctx = createMockCtx();
    const comp = makeComp({ retryCount: 1 });
    ctx.model.TaskCompletionLog.findAll.mockResolvedValue([comp]);
    ctx.service.member.addPoints.mockRejectedValue(new Error('db down'));

    const task = createTask(ctx);
    await task.subscribe();

    expect(comp.update).toHaveBeenCalledTimes(1);
    const updateArg = comp.update.mock.calls[0][0];
    expect(updateArg.retryCount).toBe(2);
    expect(updateArg.status).toBeUndefined(); // 未到上限不应改 status
    expect(updateArg.errorMsg).toBe('db down');
    expect(updateArg.nextRetryAt).toBeInstanceOf(Date);
    // 日志：retry 而非 ALERT
    expect(ctx.logger.error).toHaveBeenCalledWith(expect.stringMatching(/\[task_resend\] retry/));
    expect(ctx.logger.error).not.toHaveBeenCalledWith(expect.stringMatching(/\[ALERT\]/));
  });

  it('case4: 失败达到上限（retryCount=4 → 5）— status=failed + [ALERT] critical 日志', async () => {
    const ctx = createMockCtx();
    const comp = makeComp({ retryCount: 4 });
    ctx.model.TaskCompletionLog.findAll.mockResolvedValue([comp]);
    ctx.service.member.addPoints.mockRejectedValue(new Error('persistent failure'));

    const task = createTask(ctx);
    await task.subscribe();

    const updateArg = comp.update.mock.calls[0][0];
    expect(updateArg.retryCount).toBe(5);
    expect(updateArg.status).toBe('failed');
    expect(updateArg.errorMsg).toBe('persistent failure');

    // 关键：[ALERT] critical 日志被打
    expect(ctx.logger.error).toHaveBeenCalledWith(
      expect.stringMatching(/\[ALERT\]\[task_resend\] critical/),
    );
    expect(ctx.logger.error).toHaveBeenCalledWith(
      expect.stringMatching(/logId=1.*userId=100.*taskCode=daily_sign.*retryCount=5/),
    );
  });

  it('case5: 指数退避 — nextRetryAt 间隔 = 2^(retryCount+1) 分钟', async () => {
    const ctx = createMockCtx();
    const comp = makeComp({ retryCount: 2 });
    ctx.model.TaskCompletionLog.findAll.mockResolvedValue([comp]);
    ctx.service.member.addPoints.mockRejectedValue(new Error('e'));

    const before = Date.now();
    const task = createTask(ctx);
    await task.subscribe();
    const after = Date.now();

    const nextRetryAt: Date = comp.update.mock.calls[0][0].nextRetryAt;
    const delayMs = nextRetryAt.getTime() - before;
    // 2^(2+1) = 8 分钟 = 480_000 ms（允许执行耗时浮动）
    expect(delayMs).toBeGreaterThanOrEqual(480_000);
    expect(delayMs).toBeLessThanOrEqual(480_000 + (after - before) + 100);
  });

  it('case6: 多条混合 — 单条失败不影响其他条目', async () => {
    const ctx = createMockCtx();
    const ok = makeComp({ id: 1, userId: 100, taskCode: 'A' });
    const fail = makeComp({ id: 2, userId: 200, taskCode: 'B', retryCount: 0 });
    const ok2 = makeComp({ id: 3, userId: 300, taskCode: 'C' });
    ctx.model.TaskCompletionLog.findAll.mockResolvedValue([ok, fail, ok2]);

    ctx.service.member.addPoints
      .mockResolvedValueOnce({ logId: 1001 })   // ok
      .mockRejectedValueOnce(new Error('fail-2')) // fail
      .mockResolvedValueOnce({ logId: 1003 });  // ok2

    const task = createTask(ctx);
    await task.subscribe();

    expect(ctx.service.member.addPoints).toHaveBeenCalledTimes(3);
    expect(ok.update).toHaveBeenCalledWith(
      { status: 'rewarded', pointsLogId: 1001 }, expect.any(Object),
    );
    expect(fail.update).toHaveBeenCalledWith(
      expect.objectContaining({ retryCount: 1, errorMsg: 'fail-2' }),
    );
    expect(ok2.update).toHaveBeenCalledWith(
      { status: 'rewarded', pointsLogId: 1003 }, expect.any(Object),
    );
  });
});
