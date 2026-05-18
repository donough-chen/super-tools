import BaseController from '../../base';

export default class NotificationChannelController extends BaseController {

  async list() {
    const { ctx } = this;
    const { channel, page = 1, pageSize = 20 } = ctx.query;
    const where: any = {};
    if (channel) where.channel = channel;

    const { rows, count } = await ctx.model.NotificationChannelConfig.findAndCountAll({
      where,
      offset: (Number(page) - 1) * Number(pageSize),
      limit: Number(pageSize),
      order: [['channel', 'ASC'], ['id', 'ASC']],
    });
    this.success({ list: rows, total: count });
  }

  async update() {
    const { ctx } = this;
    const id = Number(ctx.params.id);
    const row = await ctx.model.NotificationChannelConfig.findByPk(id);
    if (!row) ctx.throw(404, '渠道配置不存在');
    await row.update(ctx.request.body as any);
    this.success(row);
  }

  async testSmtp() {
    const { ctx } = this;
    try {
      const ok = await ctx.service.mail.verify();
      this.success({ ok, message: 'SMTP 连接成功' });
    } catch (e: any) {
      this.success({ ok: false, message: `SMTP 连接失败: ${e.message}` });
    }
  }
}
