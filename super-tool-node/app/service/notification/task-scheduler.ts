/**
 * @file 任务调度服务
 * @description 管理通知发送任务的调度生命周期，支持四种调度模式：
 *   - immediate: 立即发送（可配置撤销窗口）
 *   - scheduled: 定时发送（指定时间点）
 *   - cron: 周期发送（Cron 表达式）
 *   - rrule: 复杂周期（iCalendar RRULE 表达式）
 *
 * 核心功能：
 * - createAndSchedule(): 创建任务并注册到 BullMQ 队列
 * - pause/resume/cancel/undo: 任务生命周期控制
 * - recoverScheduledTasks(): 服务重启后恢复未完成的调度任务
 * - scanStuckTasks(): 检测并标记超时卡死的任务
 *
 * @module service/notification/task-scheduler
 */
import BaseService from '../base';
import { getSendQueue } from '../../queue/queues';
import { isValidCron, getNextCronTime } from '../../lib/cronHelper';
import { isValidRRule, getNextOccurrence } from '../../lib/rruleHelper';
import task from '@/controller/admin/notification/task';

type SendType = 'immediate' | 'scheduled' | 'cron' | 'rrule';
type TaskStatus = 'pending' | 'scheduled' | 'running' | 'paused' | 'completed' | 'failed' | 'canceled';

export default class NotificationTaskSchedulerService extends BaseService {

  /**
   * 创建任务并注册到队列
   * 根据 sendType 设置初始状态和 nextFireAt，然后调用 _scheduleTask 入队
   */
  async createAndSchedule(input: {
    name: string; typeId: number; templateCode: string; channels: string[];
    audienceType: string; staticUserIds?: number[]; dynamicRules?: any; variables: Record<string, any>;
    sendType: SendType; scheduledAt?: string; cronExpression?: string; rrule?: string;
    undoWindowSec?: number; priority?: number; description?: string; createdBy?: number;
  }) {
    const { ctx } = this;
    if (input.sendType === 'cron' && input.cronExpression && !isValidCron(input.cronExpression)) ctx.throw(400, 'Cron 表达式非法');
    if (input.sendType === 'rrule' && input.rrule && !isValidRRule(input.rrule)) ctx.throw(400, 'RRULE 格式非法');
    if (input.sendType === 'scheduled' && input.scheduledAt && new Date(input.scheduledAt).getTime() - Date.now() < 30000) ctx.throw(400, '定时时间必须在 30 秒后');

    // 根据调度类型设置初始状态和下次触发时间
    // immediate + undoWindowSec: 延迟发送（给用户撤销窗口）
    let status: TaskStatus = 'pending';
    let nextFireAt: Date | null = null;
    switch (input.sendType) {
      case 'immediate': status = input.undoWindowSec ? 'scheduled' : 'running'; nextFireAt = input.undoWindowSec ? new Date(Date.now() + input.undoWindowSec * 1000) : null; break;
      case 'scheduled': status = 'scheduled'; nextFireAt = input.scheduledAt ? new Date(input.scheduledAt) : null; break;
      case 'cron': status = 'scheduled'; nextFireAt = input.cronExpression ? getNextCronTime(input.cronExpression) : null; break;
      case 'rrule': status = 'scheduled'; nextFireAt = input.rrule ? getNextOccurrence(input.rrule) : null; break;
    }

    const task = await ctx.model.NotificationTask.create({
      name: input.name, description: input.description || null, typeId: input.typeId,
      templateCode: input.templateCode, channels: input.channels,
      audienceSnapshot: input.audienceType === 'static' ? { userIds: input.staticUserIds || [] } : null,
      variables: input.variables || {}, scheduleType: input.sendType,
      scheduledAt: input.scheduledAt ? new Date(input.scheduledAt) : null,
      cronExpression: input.cronExpression || null, rrule: input.rrule || null,
      undoWindowSec: input.undoWindowSec || 0, priority: input.priority ?? 2,
      status, nextFireAt, source: 'admin', createdBy: input.createdBy || null,
    });
    await this._scheduleTask(task);
    return task;
  }

  /** 暂停任务（仅 running/scheduled 状态可暂停），同时从队列移除 */
  async pause(taskId: number) {
    const { ctx } = this;
    const task = await ctx.model.NotificationTask.findByPk(taskId);
    if (!task) ctx.throw(404, '任务不存在');
    if (!['running', 'scheduled'].includes((task as any).status)) ctx.throw(400, '当前状态不允许暂停');
    await task.update({ status: 'paused', pausedAt: new Date() });
    await this._removeFromQueue(task);
    return task;
  }

  /** 恢复已暂停的任务，重新注册到队列 */
  async resume(taskId: number) {
    const { ctx } = this;
    const task = await ctx.model.NotificationTask.findByPk(taskId);
    if (!task) ctx.throw(404, '任务不存在');
    if ((task as any).status !== 'paused') ctx.throw(400, '仅暂停状态可恢复');
    await task.update({ status: 'scheduled', pausedAt: null });
    await this._scheduleTask(task);
    return task;
  }

  /** 取消任务（已完成/已取消的不可再取消） */
  async cancel(taskId: number) {
    const { ctx } = this;
    const task = await ctx.model.NotificationTask.findByPk(taskId);
    if (!task) ctx.throw(404, '任务不存在');
    if (['completed', 'canceled'].includes((task as any).status)) ctx.throw(400, '已完成或已取消的任务不可再取消');
    await task.update({ status: 'canceled', canceledAt: new Date() });
    await this._removeFromQueue(task);
    return task;
  }

  /** 撤销任务（仅限带撤销窗口的即时任务，且在窗口期内） */
  async undo(taskId: number) {
    const { ctx } = this;
    const task = await ctx.model.NotificationTask.findByPk(taskId);
    if (!task) ctx.throw(404, '任务不存在');
    const t = task as any;
    if (t.scheduleType !== 'immediate' || !t.undoWindowSec) ctx.throw(400, '此任务不支持撤销');
    if (Date.now() > new Date(t.createdAt).getTime() + t.undoWindowSec * 1000) ctx.throw(400, '撤销窗口已过');
    await task.update({ status: 'canceled', canceledAt: new Date() });
    await this._removeFromQueue(task);
    return task;
  }

  /** 服务重启后恢复未完成的 cron/rrule 任务 */
  async recoverScheduledTasks() {
    const tasks = await this.ctx.model.NotificationTask.findAll({ where: { status: ['scheduled', 'running'], scheduleType: ['cron', 'rrule'] } });
    for (const task of tasks) {
      try { await this._scheduleTask(task); this.ctx.logger.info(`[scheduler] recovered task ${(task as any).id}`); }
      catch (e: any) { this.ctx.logger.error(`[scheduler] recover task ${(task as any).id} failed: ${e.message}`); }
    }
    return tasks.length;
  }

  /** 检测并标记超时卡死的任务（running 超过 30 分钟） */
  async scanStuckTasks() {
    const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000);
    const [affectedCount] = await this.ctx.model.NotificationTask.update(
      { status: 'failed', errorMessage: 'Stuck: running > 30min, auto-recovered by boot scan' },
      { where: { status: 'running', startedAt: { [require('sequelize').Op.lt]: thirtyMinAgo } } },
    );
    if (affectedCount > 0) this.ctx.logger.warn(`[scheduler] marked ${affectedCount} stuck tasks as failed`);
    return affectedCount;
  }

  /**
   * 将任务注册到 BullMQ 队列
   * - immediate: 延迟 = undoWindowSec（或 0）
   * - scheduled: 延迟 = scheduledAt - now
   * - cron: 使用 BullMQ repeat 模式
   * - rrule: 计算下次触发时间作为延迟（链式调度）
   */
  private async _scheduleTask(task: any) {
    const t = task.toJSON ? task.toJSON() : task;
    const queue = getSendQueue(this.app);
    switch (t.scheduleType) {
      case 'immediate': { const delay = t.undoWindowSec ? t.undoWindowSec * 1000 : 0; await queue.add('task:fire', { taskId: t.id }, { jobId: `task-${t.id}`, delay }); break; }
      case 'scheduled': { const delay = Math.max(0, new Date(t.scheduledAt).getTime() - Date.now()); await queue.add('task:fire', { taskId: t.id }, { jobId: `task-${t.id}`, delay }); break; }
      case 'cron': { if (t.cronExpression) await queue.add('task:fire', { taskId: t.id }, { jobId: `task-cron-${t.id}`, repeat: { pattern: t.cronExpression } }); break; }
      case 'rrule': { if (t.rrule) { const next = getNextOccurrence(t.rrule); if (next) { const delay = Math.max(0, next.getTime() - Date.now()); await queue.add('task:fire', { taskId: t.id, rruleChain: true }, { jobId: `task-rrule-${t.id}-${next.getTime()}`, delay }); } } break; }
    }
  }

  /** 从队列中移除任务（暂停/取消时调用） */
  private async _removeFromQueue(task: any) {
    const t = task.toJSON ? task.toJSON() : task;
    const queue = getSendQueue(this.app);
    try {
      const job = await queue.getJob(`task-${t.id}`);
      if (job) await job.remove();
      if (t.scheduleType === 'cron' && t.cronExpression) await queue.removeRepeatable('task:fire', { pattern: t.cronExpression });
    } catch (e: any) { this.ctx.logger.warn(`[scheduler] remove from queue failed for task ${t.id}: ${e.message}`); }
  }
}
