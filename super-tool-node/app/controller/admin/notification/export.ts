import BaseController from '../../base';

export default class NotificationExportController extends BaseController {
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

  async list() {
    const { ctx } = this;
    const adminUser = (ctx as any).adminUser || (ctx as any).state?.user;
    const r = await (ctx.service.notification as any).export.list(adminUser?.id || 0, Number(ctx.query.page) || 1);
    this.success(r);
  }

  async download() {
    const { ctx } = this;
    const r = await (ctx.service.notification as any).export.getDownloadStream(Number(ctx.params.id));
    ctx.set('Content-Disposition', `attachment; filename="${r.filename}"`);
    ctx.set('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    ctx.body = r.stream;
  }
}
