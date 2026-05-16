import { Controller } from 'egg';

export default class NotificationStatsController extends Controller {
  async overview() {
    const { ctx } = this;
    const { from, to } = ctx.query;
    const r = await ctx.service.notificationStats.overview({
      from: new Date(String(from)), to: new Date(String(to)),
    });
    (ctx as any).success(r);
  }

  async trend() {
    const { ctx } = this;
    const { from, to, granularity } = ctx.query;
    const r = await ctx.service.notificationStats.trend({
      from: new Date(String(from)), to: new Date(String(to)),
      granularity: (granularity as any) || 'day',
    });
    (ctx as any).success(r);
  }

  async byChannel() {
    const { ctx } = this;
    const { from, to } = ctx.query;
    const r = await ctx.service.notificationStats.byChannel({
      from: new Date(String(from)), to: new Date(String(to)),
    });
    (ctx as any).success(r);
  }

  async byType() {
    const { ctx } = this;
    const { from, to, limit } = ctx.query;
    const r = await ctx.service.notificationStats.byType({
      from: new Date(String(from)), to: new Date(String(to)),
      limit: Number(limit) || 5,
    });
    (ctx as any).success(r);
  }

  async funnel() {
    const { ctx } = this;
    const { from, to, typeKey } = ctx.query;
    const r = await ctx.service.notificationStats.funnel({
      from: new Date(String(from)), to: new Date(String(to)),
      typeKey: typeKey as string | undefined,
    });
    (ctx as any).success(r);
  }
}
