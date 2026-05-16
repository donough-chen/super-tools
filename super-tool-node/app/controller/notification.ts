import { Controller } from 'egg';
import { Op } from 'sequelize';

/**
 * C 端（用户视角）通知 API
 */
export default class NotificationController extends Controller {

  /**
   * 消息列表
   */
  async list() {
    const { ctx } = this;
    const user = (ctx as any).state?.user || (ctx as any).user;
    const userId = user?.id;
    if (!userId) ctx.throw(401, '未授权');

    const { isRead, typeId, archived = '0', page = 1, pageSize = 20 } = ctx.query;
    const where: any = { userId };
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
      order: [['createdAt', 'DESC']],
    });
    (ctx as any).success({ list: rows, total: count, page: Number(page), pageSize: Number(pageSize) });
  }

  /**
   * 未读数
   */
  async unreadCount() {
    const { ctx } = this;
    const user = (ctx as any).state?.user || (ctx as any).user;
    const count = await ctx.model.NotificationMessage.count({
      where: { userId: user.id, isRead: 0, isArchived: 0 },
    });
    (ctx as any).success({ count });
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
    (ctx as any).success(msg);
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
    (ctx as any).success({ affected });
  }

  /**
   * 全部标记已读
   */
  async markAllRead() {
    const { ctx } = this;
    const user = (ctx as any).state?.user || (ctx as any).user;
    const [affected] = await ctx.model.NotificationMessage.update(
      { isRead: 1, readAt: new Date() },
      { where: { userId: user.id, isRead: 0, isArchived: 0 } },
    );
    (ctx as any).success({ affected });
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
    (ctx as any).success();
  }

  /**
   * 偏好列表
   */
  async listPreferences() {
    const { ctx } = this;
    const user = (ctx as any).state?.user || (ctx as any).user;
    const list = await ctx.service.notificationPreference.listForUser({ userId: user.id });
    (ctx as any).success(list);
  }

  /**
   * 偏好更新
   */
  async upsertPreference() {
    const { ctx } = this;
    const user = (ctx as any).state?.user || (ctx as any).user;
    const body = ctx.request.body as any;
    const row = await ctx.service.notificationPreference.upsert({
      userId: user.id,
      typeId: body.typeId,
      channel: body.channel,
      isSubscribed: !!body.isSubscribed,
    });
    (ctx as any).success(row);
  }
}
