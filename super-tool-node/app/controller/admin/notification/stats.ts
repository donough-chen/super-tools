import BaseController from '../../base';

export default class NotificationStatsController extends BaseController {
  async overview() {
    const { ctx } = this;
    const { from, to } = ctx.query;
    this.success(await (ctx.service.notification as any).stats.overview({ from: new Date(String(from)), to: new Date(String(to)) }));
  }

  async trend() {
    const { ctx } = this;
    const { from, to, granularity } = ctx.query;
    this.success(await (ctx.service.notification as any).stats.trend({
      from: new Date(String(from)), to: new Date(String(to)), granularity: (granularity as any) || 'day',
    }));
  }

  async byChannel() {
    const { ctx } = this;
    const { from, to } = ctx.query;
    this.success(await (ctx.service.notification as any).stats.byChannel({ from: new Date(String(from)), to: new Date(String(to)) }));
  }

  async byType() {
    const { ctx } = this;
    const { from, to, limit } = ctx.query;
    this.success(await (ctx.service.notification as any).stats.byType({
      from: new Date(String(from)), to: new Date(String(to)), limit: Number(limit) || 5,
    }));
  }

  async funnel() {
    const { ctx } = this;
    const { from, to, typeKey } = ctx.query;
    this.success(await (ctx.service.notification as any).stats.funnel({
      from: new Date(String(from)), to: new Date(String(to)), typeKey: typeKey as string | undefined,
    }));
  }
}
