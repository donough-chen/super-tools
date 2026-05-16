import { Controller } from 'egg';

export default class NotificationQueueMonitorController extends Controller {
  async depths() {
    const { ctx } = this;
    const data = await ctx.service.notificationQueueMonitor.getDepths();
    (ctx as any).success(data);
  }
}
