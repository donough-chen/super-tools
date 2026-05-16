import { Controller } from 'egg';

/**
 * Admin 渠道服务商配置
 */
export default class NotificationChannelController extends Controller {

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
    (ctx as any).success({ list: rows, total: count });
  }

  async update() {
    const { ctx } = this;
    const id = Number(ctx.params.id);
    const row = await ctx.model.NotificationChannelConfig.findByPk(id);
    if (!row) ctx.throw(404, '渠道配置不存在');
    await row.update(ctx.request.body as any);
    (ctx as any).success(row);
  }

  /**
   * 测试 SMTP 连接
   */
  async testSmtp() {
    const { ctx } = this;
    try {
      const ok = await ctx.service.mail.verify();
      (ctx as any).success({ ok, message: 'SMTP 连接成功' });
    } catch (e: any) {
      (ctx as any).success({ ok: false, message: `SMTP 连接失败: ${e.message}` });
    }
  }
}
