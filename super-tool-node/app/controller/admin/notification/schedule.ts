import BaseController from '../../base';

export default class NotificationScheduleController extends BaseController {
  async list() {
    this.success(await (this.ctx.service.notification as any).schedule.list());
  }
  async pause() {
    this.success(await (this.ctx.service.notification as any).schedule.pause(Number(this.ctx.params.id)));
  }
  async resume() {
    this.success(await (this.ctx.service.notification as any).schedule.resume(Number(this.ctx.params.id)));
  }
}
