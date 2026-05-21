/**
 * @file 管理端 - 渠道配置控制器
 * @description 管理通知渠道服务商配置（SMTP/短信/站内信），支持配置更新和 SMTP 连通性测试。
 * @module controller/admin/notification/channel
 */
import BaseController from '../../base';

export default class NotificationChannelController extends BaseController {

  /** 渠道配置列表（分页），支持按渠道类型筛选 */
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

  /** 更新渠道配置（凭证信息 AES 加密存储） */
  async update() {
    const { ctx } = this;
    const id = Number(ctx.params.id);
    const row = await ctx.model.NotificationChannelConfig.findByPk(id);
    if (!row) ctx.throw(404, '渠道配置不存在');
    await row.update(ctx.request.body as any);
    this.success(row);
  }

  /** 测试 SMTP 连通性，返回连接成功/失败状态 */
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
