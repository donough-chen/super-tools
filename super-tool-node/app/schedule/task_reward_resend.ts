import { Subscription } from 'egg';

/**
 * 任务奖励补发扫描
 *  设计依据: docs/superpowers/plans/2026-05-26-积分成长体系MVP实施计划-v2.md §Task 8
 *
 *  触发场景：TaskService.claim 中 member.addPoints 异常（DB 抖动 / 事务回滚）→
 *           task_completion_logs.status 卡在 pending 但 user_tasks.status 已 claimed
 *  策略：每 5 分钟扫描一次，每批最多 100 条；指数退避（2^n 分钟）；超 5 次置 failed
 */
export default class TaskRewardResendSchedule extends Subscription {
  static get schedule() {
    return {
      interval: '5m',
      type: 'worker',     // 仅一个 worker 执行（避免重复）
      immediate: false,
    };
  }

  async subscribe() {
    const { ctx } = this;
    const { Op } = require('sequelize');

    const pendings: any[] = await ctx.model.TaskCompletionLog.findAll({
      where: {
        status: 'pending',
        retryCount: { [Op.lt]: 5 },
        [Op.or]: [
          { nextRetryAt: null },
          { nextRetryAt: { [Op.lte]: new Date() } },
        ],
      },
      limit: 100,
    });

    for (const comp of pendings as any[]) {
      try {
        await (ctx.model as any).transaction(async (t: any) => {
          const result: any = await ctx.service.member.addPoints({
            userId: comp.userId,
            points: comp.rewardPoints,
            growthDelta: comp.rewardGrowth,
            source: 'task_reward',
            event: 'task_reward',
            bizType: 'task',
            bizId: comp.taskCode,
            remark: `任务奖励补发：${comp.taskCode}`,
            applyMultiplier: false,
            transaction: t,
          });
          await comp.update(
            { status: 'rewarded', pointsLogId: result.logId },
            { transaction: t },
          );
        });
        ctx.logger.info(`[task_resend] ok user=${comp.userId} task=${comp.taskCode}`);
      } catch (err: any) {
        const nextRetryDelay = Math.pow(2, comp.retryCount + 1) * 60_000; // 指数退避
        const next = new Date(Date.now() + nextRetryDelay);
        const newRetryCount = comp.retryCount + 1;
        const updateData: any = {
          retryCount: newRetryCount,
          nextRetryAt: next,
          errorMsg: err.message,
        };
        if (newRetryCount >= 5) {
          updateData.status = 'failed';
        }
        await comp.update(updateData);
        ctx.logger.error(`[task_resend] retry user=${comp.userId} task=${comp.taskCode} err=${err.message}`);
      }
    }
  }
}
