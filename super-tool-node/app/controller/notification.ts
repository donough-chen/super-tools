/**
 * @file C 端（用户视角）通知 API 控制器
 * @description 提供用户侧的通知消息管理接口，包括消息列表、未读计数、标记已读、归档、
 *              通知类型查询和订阅偏好管理。所有接口均需 JWT 鉴权。
 *              仅展示 channels 包含 in_app 的站内信消息。
 * @module controller/notification
 */
import { Op } from 'sequelize';
import BaseController from './base';

export default class NotificationController extends BaseController {

  /**
   * 消息列表（分页）
   * 支持按已读状态、通知类型、归档状态筛选
   * 仅返回 channels 包含 in_app 的站内信消息
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
   * 未读消息数量
   * 用于前端消息铃铛角标展示，仅统计未归档的站内信
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
   * 查看消息详情时自动标记为已读（触发 read_at 回写）
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
   * @body ids - 消息ID数组，仅标记属于当前用户且未读的消息
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
   * 将当前用户所有未读、未归档的站内信标记为已读
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
   * 归档消息
   * 归档后消息不在主列表展示，但可通过 archived=1 查询
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
   * 消息类型列表
   * 仅返回 defaultChannels 包含 in_app 的启用类型，用于 C 端筛选和偏好设置
   */
  async listTypes() {
    const { ctx } = this;
    const rows = await ctx.model.NotificationType.findAll({
      where: { status: 1 },
      // 包含 defaultChannels 用于过滤，最终不返回给前端
      attributes: ['id', 'code', 'name', 'icon', 'color', 'category', 'sortOrder', 'defaultChannels'],
      order: [['sort_order', 'ASC']],
    });
    // 过滤 defaultChannels 包含 in_app 的类型，并移除该字段
    const filtered = (rows as any[])
      .filter((row) => {
        const channels: string[] = row.defaultChannels || [];
        return Array.isArray(channels) && channels.includes('in_app');
      })
      .map((row) => {
        const { defaultChannels: _omit, ...rest } = row.toJSON ? row.toJSON() : row;
        return rest;
      });
    this.success(filtered);
  }

  /**
   * 用户订阅偏好列表
   * 返回所有通知类型×渠道的订阅状态（稀疏存储：无记录=默认订阅）
   */
  async listPreferences() {
    const { ctx } = this;
    const user = (ctx as any).state?.user || (ctx as any).user;
    const list = await ctx.service.notification.preference.listForUser({ userId: user.id });
    this.success(list);
  }

  /**
   * 更新订阅偏好
   * 用户可取消/恢复对特定类型×渠道的订阅（user_cancelable=0 的类型不允许取消）
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
