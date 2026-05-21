/**
 * @file 管理端 - 队列监控控制器
 * @description 查看通知系统各消息队列的深度（active/waiting/delayed/failed/completed）。
 * @module controller/admin/notification/queue-monitor
 */
import BaseController from '../../base';

export default class NotificationQueueMonitorController extends BaseController {
  /** 获取各队列的 job 计数（用于管理端监控面板） */
  async depths() {
    this.success(await (this.ctx.service.notification as any).queueMonitor.getDepths());
  }
}
