/**
 * @file 管理端 - 定时调度控制器
 * @description 管理通知系统内部定时任务（如消息清理、会员到期提醒、健康检查等）的暂停/恢复。
 * @module controller/admin/notification/schedule
 */
import BaseController from '../../base';

export default class NotificationScheduleController extends BaseController {
  /** 获取所有定时调度任务列表 */
  async list() {
    this.success(await (this.ctx.service.notification as any).schedule.list());
  }
  /** 暂停指定调度任务 */
  async pause() {
    this.success(await (this.ctx.service.notification as any).schedule.pause(Number(this.ctx.params.id)));
  }
  /** 恢复指定调度任务 */
  async resume() {
    this.success(await (this.ctx.service.notification as any).schedule.resume(Number(this.ctx.params.id)));
  }
}
