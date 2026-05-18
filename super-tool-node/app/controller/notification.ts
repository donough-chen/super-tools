import { Op } from 'sequelize';
import BaseController from './base';

/**
 * C 端（用户视角）通知 API
 */
export default class NotificationController extends BaseController {

  /**
   * 消息列表
   */
  async list() {
    const { ctx } = this;
    const user = (ctx as any).state?.user || (ctx as any).user;
    const userId = user?.id;
    if (!userId) ctx.throw(401, '未授权');

    const { isRead, typeId, archived = '0', page = 1, pageSize = 20 } = ctx.query;
    const where: any = { 
      userId,
      channels: { [Op.like]: '%in_app%' }
    };
    if (isRead !== undefined) where.isRead = Number(isRead);
    if (typeId) where.typeId = Number(typeId);
    if (archived === '1') {
      where.isArchived = 1;
    } else {
      where.isArchived = 0;
    }

    const { rows, count } = await ctx.model.NotificationMessage.findAndCountAll({
      where,
      include: [{ model: ctx.model.NotificationType, as: 'type', attributes: ['id', 'code', 'name', 'icon', 'color'] }],
      offset: (Number(page) - 1) * Number(pageSize),
      limit: Number(pageSize),
      order: [['created_at', 'DESC']],
    });
    this.success({ list: rows, total: count, page: Number(page), pageSize: Number(pageSize) });
  }

  /**
   * 未读数
   */
  async unreadCount() {
    const { ctx } = this;
    const user = (ctx as any).state?.user || (ctx as any).user;
    const count = await ctx.model.NotificationMessage.count({
      where: { 
        userId: user.id, 
        isRead: 0, 
        isArchived: 0,
        channels: { [Op.like]: '%in_app%' }
      },
    });
    this.success({ count });
  }

  /**
   * 消息详情
   */
  async detail() {
    const { ctx } = this;
    const user = (ctx as any).state?.user || (ctx as any).user;
    const id = Number(ctx.params.id);
    const msg = await ctx.model.NotificationMessage.findOne({
      where: { id, userId: user.id },
      include: [{ model: ctx.model.NotificationType, as: 'type', attributes: ['id', 'code', 'name', 'icon', 'color'] }],
    });
    if (!msg) ctx.throw(404, '消息不存在或无权访问');

    // 自动标记已读
    if (!(msg as any).isRead) {
      await msg.update({ isRead: 1, readAt: new Date() });
    }
    this.success(msg);
  }

  /**
   * 批量标记已读
   */
  async markRead() {
    const { ctx } = this;
    const user = (ctx as any).state?.user || (ctx as any).user;
    const body = ctx.request.body as any;
    const ids: number[] = body.ids || [];
    if (ids.length === 0) ctx.throw(400, 'ids 不能为空');

    const [affected] = await ctx.model.NotificationMessage.update(
      { isRead: 1, readAt: new Date() },
      { where: { id: { [Op.in]: ids }, userId: user.id, isRead: 0 } },
    );
    this.success({ affected });
  }

  /**
   * 全部标记已读
   */
  async markAllRead() {
    const { ctx } = this;
    const user = (ctx as any).state?.user || (ctx as any).user;
    const [affected] = await ctx.model.NotificationMessage.update(
      { isRead: 1, readAt: new Date() },
      { 
        where: { 
          userId: user.id, 
          isRead: 0, 
          isArchived: 0,
          channels: { [Op.like]: '%in_app%' }
        } 
      },
    );
    this.success({ affected });
  }

  /**
   * 归档
   */
  async archive() {
    const { ctx } = this;
    const user = (ctx as any).state?.user || (ctx as any).user;
    const id = Number(ctx.params.id);
    const [affected] = await ctx.model.NotificationMessage.update(
      { isArchived: 1, archivedAt: new Date() },
      { where: { id, userId: user.id } },
    );
    if (affected === 0) ctx.throw(404, '消息不存在或无权操作');
    this.success();
  }

  /**
   * 偏好列表
   */
  async listPreferences() {
    const { ctx } = this;
    const user = (ctx as any).state?.user || (ctx as any).user;
    const list = await ctx.service.notification.preference.listForUser({ userId: user.id });
    this.success(list);
  }

  /**
   * 偏好更新
   */
  async upsertPreference() {
    const { ctx } = this;
    const user = (ctx as any).state?.user || (ctx as any).user;
    const body = ctx.request.body as any;
    const row = await ctx.service.notification.preference.upsert({
      userId: user.id,
      typeId: body.typeId,
      channel: body.channel,
      isSubscribed: !!body.isSubscribed,
    });
    this.success(row);
  }
}
