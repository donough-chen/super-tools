import BaseService from './base';
import { getSendQueue } from '../queue/queues';
import { isValidCron, getNextCronTime } from '../lib/cronHelper';
import { isValidRRule, getNextOccurrence } from '../lib/rruleHelper';

type SendType = 'immediate' | 'scheduled' | 'cron' | 'rrule';
type TaskStatus = 'pending' | 'scheduled' | 'running' | 'paused' | 'completed' | 'failed' | 'canceled';

/**
 * 任务调度服务
 *
 * 4 种 sendType：
 * - immediate: 立即（或 30s 撤销窗口后）执行
 * - scheduled: 一次性定时（BullMQ delayed job）
 * - cron: 周期执行（BullMQ repeatable）
 * - rrule: RRULE 规则（链式 delayed job）
 */
export default class NotificationTaskSchedulerService extends BaseService {

  /**
   * 创建并调度任务
   */
  async createAndSchedule(input: {
    name: string;
    typeId: number;
    templateCode: string;
    channels: string[];
    audienceType: string;
    staticUserIds?: number[];
    variables: Record<string, any>;
    sendType: SendType;
    scheduledAt?: string;
    cronExpression?: string;
    rrule?: string;
    undoWindowSec?: number;
    priority?: number;
    description?: string;
    createdBy?: number;
  }) {
    const { ctx } = this;

    // 验证
    if (input.sendType === 'cron' && input.cronExpression && !isValidCron(input.cronExpression)) {
      ctx.throw(400, 'Cron 表达式非法');
    }
    if (input.sendType === 'rrule' && input.rrule && !isValidRRule(input.rrule)) {
      ctx.throw(400, 'RRULE 格式非法');
    }
    if (input.sendType === 'scheduled' && input.scheduledAt) {
      const targetTs = new Date(input.scheduledAt).getTime();
      if (targetTs - Date.now() < 30000) {
        ctx.throw(400, '定时时间必须在 30 秒后');
      }
    }

    // 计算初始状态和 nextFireAt
    let status: TaskStatus = 'pending';
    let nextFireAt: Date | null = null;

    switch (input.sendType) {
      case 'immediate':
        status = input.undoWindowSec ? 'scheduled' : 'running';
        nextFireAt = input.undoWindowSec
          ? new Date(Date.now() + (input.undoWindowSec * 1000))
          : null;
        break;
      case 'scheduled':
        status = 'scheduled';
        nextFireAt = input.scheduledAt ? new Date(input.scheduledAt) : null;
        break;
      case 'cron':
        status = 'scheduled';
        nextFireAt = input.cronExpression ? getNextCronTime(input.cronExpression) : null;
        break;
      case 'rrule':
        status = 'scheduled';
        nextFireAt = input.rrule ? getNextOccurrence(input.rrule) : null;
        break;
    }

    // 入库
    const task = await ctx.model.NotificationTask.create({
      name: input.name,
      description: input.description || null,
      typeId: input.typeId,
      templateCode: input.templateCode,
      channels: input.channels,
      audienceSnapshot: input.audienceType === 'static' ? { userIds: input.staticUserIds || [] } : null,
      variables: input.variables || {},
      scheduleType: input.sendType,
      scheduledAt: input.scheduledAt ? new Date(input.scheduledAt) : null,
      cronExpression: input.cronExpression || null,
      rrule: input.rrule || null,
      undoWindowSec: input.undoWindowSec || 0,
      priority: input.priority ?? 2,
      status,
      nextFireAt,
      source: 'admin',
      createdBy: input.createdBy || null,
    });

    // 调度到 BullMQ
    await this._scheduleTask(task);
    return task;
  }

  /**
   * 暂停任务
   */
  async pause(taskId: number) {
    const { ctx } = this;
    const task = await ctx.model.NotificationTask.findByPk(taskId);
    if (!task) ctx.throw(404, '任务不存在');

    const status = (task as any).status;
    if (!['running', 'scheduled'].includes(status)) {
      ctx.throw(400, '当前状态不允许暂停');
    }

    await task.update({ status: 'paused', pausedAt: new Date() });
    // 从 BullMQ 移除 repeatable（cron/rrule 场景）
    await this._removeFromQueue(task);
    return task;
  }

  /**
   * 恢复任务
   */
  async resume(taskId: number) {
    const { ctx } = this;
    const task = await ctx.model.NotificationTask.findByPk(taskId);
    if (!task) ctx.throw(404, '任务不存在');

    if ((task as any).status !== 'paused') {
      ctx.throw(400, '仅暂停状态可恢复');
    }

    await task.update({ status: 'scheduled', pausedAt: null });
    await this._scheduleTask(task);
    return task;
  }

  /**
   * 取消任务
   */
  async cancel(taskId: number) {
    const { ctx } = this;
    const task = await ctx.model.NotificationTask.findByPk(taskId);
    if (!task) ctx.throw(404, '任务不存在');

    const status = (task as any).status;
    if (['completed', 'canceled'].includes(status)) {
      ctx.throw(400, '已完成或已取消的任务不可再取消');
    }

    await task.update({ status: 'canceled', canceledAt: new Date() });
    await this._removeFromQueue(task);
    return task;
  }

  /**
   * 30 秒撤销（仅 immediate + undoWindowSec > 0 的任务）
   */
  async undo(taskId: number) {
    const { ctx } = this;
    const task = await ctx.model.NotificationTask.findByPk(taskId);
    if (!task) ctx.throw(404, '任务不存在');

    const t = task as any;
    if (t.scheduleType !== 'immediate' || !t.undoWindowSec) {
      ctx.throw(400, '此任务不支持撤销');
    }

    const deadline = new Date(t.createdAt).getTime() + t.undoWindowSec * 1000;
    if (Date.now() > deadline) {
      ctx.throw(400, '撤销窗口已过');
    }

    await task.update({ status: 'canceled', canceledAt: new Date() });
    await this._removeFromQueue(task);
    return task;
  }

  /**
   * 启动时恢复 cron/rrule 任务的 BullMQ job
   */
  async recoverScheduledTasks() {
    const tasks = await this.ctx.model.NotificationTask.findAll({
      where: { status: ['scheduled', 'running'], scheduleType: ['cron', 'rrule'] },
    });
    for (const task of tasks) {
      try {
        await this._scheduleTask(task);
        this.ctx.logger.info(`[scheduler] recovered task ${(task as any).id}`);
      } catch (e: any) {
        this.ctx.logger.error(`[scheduler] recover task ${(task as any).id} failed: ${e.message}`);
      }
    }
    return tasks.length;
  }

  /**
   * 扫描 Stuck 任务（running 超过 30 分钟）
   */
  async scanStuckTasks() {
    const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000);
    const [affectedCount] = await this.ctx.model.NotificationTask.update(
      { status: 'failed', errorMessage: 'Stuck: running > 30min, auto-recovered by boot scan' },
      {
        where: {
          status: 'running',
          startedAt: { [require('sequelize').Op.lt]: thirtyMinAgo },
        },
      },
    );
    if (affectedCount > 0) {
      this.ctx.logger.warn(`[scheduler] marked ${affectedCount} stuck tasks as failed`);
    }
    return affectedCount;
  }

  // -------- 内部方法 --------

  private async _scheduleTask(task: any) {
    const t = task.toJSON ? task.toJSON() : task;
    const queue = getSendQueue(this.app);

    switch (t.scheduleType) {
      case 'immediate': {
        const delay = t.undoWindowSec ? t.undoWindowSec * 1000 : 0;
        await queue.add('task:fire', { taskId: t.id }, {
          jobId: `task-${t.id}`,
          delay,
        });
        break;
      }
      case 'scheduled': {
        const delay = Math.max(0, new Date(t.scheduledAt).getTime() - Date.now());
        await queue.add('task:fire', { taskId: t.id }, {
          jobId: `task-${t.id}`,
          delay,
        });
        break;
      }
      case 'cron': {
        if (t.cronExpression) {
          await queue.add('task:fire', { taskId: t.id }, {
            jobId: `task-cron-${t.id}`,
            repeat: { pattern: t.cronExpression },
          });
        }
        break;
      }
      case 'rrule': {
        if (t.rrule) {
          const next = getNextOccurrence(t.rrule);
          if (next) {
            const delay = Math.max(0, next.getTime() - Date.now());
            await queue.add('task:fire', { taskId: t.id, rruleChain: true }, {
              jobId: `task-rrule-${t.id}-${next.getTime()}`,
              delay,
            });
          }
        }
        break;
      }
    }
  }

  private async _removeFromQueue(task: any) {
    const t = task.toJSON ? task.toJSON() : task;
    const queue = getSendQueue(this.app);
    try {
      // 尝试移除 delayed/repeatable
      const job = await queue.getJob(`task-${t.id}`);
      if (job) await job.remove();

      if (t.scheduleType === 'cron' && t.cronExpression) {
        await queue.removeRepeatable('task:fire', { pattern: t.cronExpression });
      }
    } catch (e: any) {
      this.ctx.logger.warn(`[scheduler] remove from queue failed for task ${t.id}: ${e.message}`);
    }
  }
}
