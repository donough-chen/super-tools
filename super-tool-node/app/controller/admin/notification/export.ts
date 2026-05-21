/**
 * @file 管理端 - 数据导出控制器
 * @description 管理通知数据的异步导出任务。支持创建导出、查看列表和下载文件。
 *              导出任务入队异步执行，完成后可选发送邮件通知，文件默认 7 天过期。
 * @module controller/admin/notification/export
 */
import BaseController from '../../base';

export default class NotificationExportController extends BaseController {
  /** 创建导出任务，指定筛选条件和可选的通知邮箱 */
  async create() {
    const { ctx } = this;
    const body = ctx.request.body as any;
    const adminUser = (ctx as any).adminUser || (ctx as any).state?.user;
    const filter = body.filter || {};
    const job = await (ctx.service.notification as any).export.create({
      name: body.name || `导出-${new Date().toISOString()}`,
      filter: { from: new Date(filter.from), to: new Date(filter.to), typeId: filter.typeId, channel: filter.channel, status: filter.status },
      recipientEmail: body.recipientEmail, operatorId: adminUser?.id || 0,
    });
    this.success(job);
  }

  /** 当前操作员的导出任务列表（分页） */
  async list() {
    const { ctx } = this;
    const adminUser = (ctx as any).adminUser || (ctx as any).state?.user;
    const r = await (ctx.service.notification as any).export.list(adminUser?.id || 0, Number(ctx.query.page) || 1);
    this.success(r);
  }

  /** 下载导出文件（仅 completed 状态且未过期的可下载） */
  async download() {
    const { ctx } = this;
    const r = await (ctx.service.notification as any).export.getDownloadStream(Number(ctx.params.id));
    ctx.set('Content-Disposition', `attachment; filename="${r.filename}"`);
    ctx.set('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    ctx.body = r.stream;
  }
}
