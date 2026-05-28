import { Subscription } from 'egg';

/**
 * 任务奖励补发扫描
 *  设计依据: docs/superpowers/plans/2026-05-26-积分成长体系MVP实施计划-v2.md §Task 8
 *           docs/superpowers/specs/2026-05-27-积分成长体系后端优化设计文档.md §2.3-#12
 *           docs/superpowers/plans/2026-05-27-积分成长体系后端优化-B业务修复实施计划.md Task B10
 *
 *  触发场景：TaskService.claim 中 member.addPoints 异常（DB 抖动 / 事务回滚）→
 *           task_completion_logs.status 卡在 pending 但 user_tasks.status 已 claimed
 *  策略：每 5 分钟扫描一次，每批最多 100 条；指数退避（2^n 分钟）；超 5 次置 failed
 *
 *  B10 巡检结论（2026-05-28）：
 *    ✓ 单次扫描上限：limit=100
 *    ✓ 重试次数上限：retryCount < 5
 *    ✓ 失败终止状态：status='failed'
 *    ✓ 指数退避：2^(retryCount+1) * 60_000ms
 *    ✓ 表字段：025 SQL 已有 retry_count/error_msg/next_retry_at（无需 SQL 改动）
 *    + 增强：失败终止（status=failed）时打 [ALERT] 标签 critical 级日志，
 *      便于运维/日志告警系统按前缀抓取（不直接写 alert_logs：AlertLog.ruleId NOT NULL FK，
 *      无 alert_rules 种子时插入会失败，保持最小变更）
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

        if (newRetryCount >= 5) {
          // 终止失败：打 [ALERT] 标签 critical 级日志（便于日志告警系统按前缀抓取）
          ctx.logger.error(
            `[ALERT][task_resend] critical: 任务奖励补发达到重试上限并终止 `
              + `logId=${comp.id} userId=${comp.userId} taskCode=${comp.taskCode} `
              + `retryCount=${newRetryCount} lastError=${err.message}`,
          );
        } else {
          ctx.logger.error(
            `[task_resend] retry user=${comp.userId} task=${comp.taskCode} `
              + `retry=${newRetryCount}/5 nextAt=${next.toISOString()} err=${err.message}`,
          );
        }
      }
    }
  }
}
