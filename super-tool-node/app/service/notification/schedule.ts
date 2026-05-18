import { Service } from 'egg';

const HANDLERS: Record<string, (ctx: any, params: any) => Promise<{ message: string }>> = {};

export function registerScheduleHandler(key: string, fn: (ctx: any, params: any) => Promise<{ message: string }>) {
  HANDLERS[key] = fn;
}

export default class NotificationScheduleService extends Service {

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

  async pause(id: number) {
    const s = await this.ctx.model.NotificationSchedule.findByPk(id);
    if (!s) this.ctx.throw(404, 'schedule 任务不存在');
    await (s as any).update({ enabled: 0 });
    return s;
  }

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
