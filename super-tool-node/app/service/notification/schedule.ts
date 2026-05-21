/**
 * @file 定时调度服务
 * @description 管理通知系统内部定时任务的注册、执行和生命周期控制。
 *   使用 handler 注册模式：各处理器通过 registerScheduleHandler() 注册，
 *   服务启动时从 notification_schedules 表加载启用的任务并计算下次触发时间。
 *   支持暂停/恢复操作，执行结果回写到数据库便于监控。
 *
 * @module service/notification/schedule
 */
import { Service } from 'egg';

/** 处理器注册表（key → handler function） */
const HANDLERS: Record<string, (ctx: any, params: any) => Promise<{ message: string }>> = {};

/**
 * 注册定时任务处理器
 * @param key 处理器标识，对应 notification_schedules.handler 字段
 * @param fn 处理函数，接收 ctx 和 params，返回执行结果消息
 */
export function registerScheduleHandler(key: string, fn: (ctx: any, params: any) => Promise<{ message: string }>) {
  HANDLERS[key] = fn;
}

export default class NotificationScheduleService extends Service {

  /** 启动时注册所有启用的定时任务，计算并回写 nextFireAt */
  async registerAll(): Promise<number> {
    const list = await this.ctx.model.NotificationSchedule.findAll({ where: { enabled: 1 } } as any);
    let count = 0;
    for (const s of list) {
      const ss = s as any;
      if (!HANDLERS[ss.handler]) { this.ctx.logger.warn(`[schedule] handler '${ss.handler}' missing for ${ss.code}`); continue; }
      try {
        const { nextFireFromCron } = require('../../lib/cronHelper');
        const next = nextFireFromCron(ss.cronExpr);
        await ss.update({ nextFireAt: next });
        count++;
        this.ctx.logger.info(`[schedule] registered ${ss.code} cron='${ss.cronExpr}' next=${next.toISOString()}`);
      } catch (e: any) { this.ctx.logger.error(`[schedule] failed to register ${ss.code}: ${e.message}`); }
    }
    return count;
  }

  /** 执行指定的定时任务，执行后更新状态和下次触发时间 */
  async executeSchedule(scheduleId: number) {
    const { ctx } = this;
    const s = await ctx.model.NotificationSchedule.findByPk(scheduleId);
    if (!s) ctx.throw(404, 'schedule 任务不存在');
    const ss = s as any;
    if (!ss.enabled) ctx.throw(400, 'schedule 已暂停');
    const handler = HANDLERS[ss.handler];
    if (!handler) ctx.throw(500, 'schedule 处理器未实现');
    try {
      const r = await handler(ctx, ss.params || {});
      const { nextFireFromCron } = require('../../lib/cronHelper');
      await ss.update({ lastFireAt: new Date(), lastStatus: 'success', lastMessage: r.message, nextFireAt: nextFireFromCron(ss.cronExpr) });
      return r;
    } catch (e: any) {
      const { nextFireFromCron } = require('../../lib/cronHelper');
      await ss.update({ lastFireAt: new Date(), lastStatus: 'failed', lastMessage: e.message, nextFireAt: nextFireFromCron(ss.cronExpr) });
      throw e;
    }
  }

  /** 暂停定时任务 */
  async pause(id: number) {
    const s = await this.ctx.model.NotificationSchedule.findByPk(id);
    if (!s) this.ctx.throw(404, 'schedule 任务不存在');
    await (s as any).update({ enabled: 0 });
    return s;
  }

  /** 恢复定时任务，重新计算 nextFireAt */
  async resume(id: number) {
    const s = await this.ctx.model.NotificationSchedule.findByPk(id);
    if (!s) this.ctx.throw(404, 'schedule 任务不存在');
    await (s as any).update({ enabled: 1 });
    const { nextFireFromCron } = require('../../lib/cronHelper');
    await (s as any).update({ nextFireAt: nextFireFromCron((s as any).cronExpr) });
    return s;
  }

  async list() {
    return this.ctx.model.NotificationSchedule.findAll({ order: [['code', 'ASC']] });
  }
}
