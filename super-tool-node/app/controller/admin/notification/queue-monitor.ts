import BaseController from '../../base';

export default class NotificationQueueMonitorController extends BaseController {
  async depths() {
    this.success(await (this.ctx.service.notification as any).queueMonitor.getDepths());
  }
}
