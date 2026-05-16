import { Controller } from 'egg';

export default class NotificationScheduleController extends Controller {
  async list() {
    const { ctx } = this;
    const list = await ctx.service.notificationSchedule.list();
    (ctx as any).success(list);
  }

  async pause() {
    const { ctx } = this;
    const r = await ctx.service.notificationSchedule.pause(Number(ctx.params.id));
    (ctx as any).success(r);
  }

  async resume() {
    const { ctx } = this;
    const r = await ctx.service.notificationSchedule.resume(Number(ctx.params.id));
    (ctx as any).success(r);
  }
}
