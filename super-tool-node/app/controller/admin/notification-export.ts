import { Controller } from 'egg';

export default class NotificationExportController extends Controller {
  async create() {
    const { ctx } = this;
    const body = ctx.request.body as any;
    const adminUser = (ctx as any).adminUser || (ctx as any).state?.user;
    const filter = body.filter || {};
    const job = await ctx.service.notificationExport.create({
      name: body.name || `导出-${new Date().toISOString()}`,
      filter: {
        from: new Date(filter.from),
        to: new Date(filter.to),
        typeId: filter.typeId,
        channel: filter.channel,
        status: filter.status,
      },
      recipientEmail: body.recipientEmail,
      operatorId: adminUser?.id || 0,
    });
    (ctx as any).success(job);
  }

  async list() {
    const { ctx } = this;
    const adminUser = (ctx as any).adminUser || (ctx as any).state?.user;
    const page = Number(ctx.query.page) || 1;
    const r = await ctx.service.notificationExport.list(adminUser?.id || 0, page);
    (ctx as any).success(r);
  }

  async download() {
    const { ctx } = this;
    const id = Number(ctx.params.id);
    const r = await ctx.service.notificationExport.getDownloadStream(id);
    ctx.set('Content-Disposition', `attachment; filename="${r.filename}"`);
    ctx.set('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    ctx.body = r.stream;
  }
}
