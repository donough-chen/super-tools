/**
 * @file 管理端 - 消息记录控制器
 * @description 查看系统中所有用户的通知消息记录，支持按用户/类型/任务/已读状态筛选。
 *              详情接口同时返回该消息的所有渠道下发日志(send_logs)。
 * @module controller/admin/notification/message
 */
import BaseController from '../../base';

export default class NotificationMessageController extends BaseController {

  /** 消息列表（分页），支持多维度筛选 */
  async list() {
    const { ctx } = this;
    const { userId, typeId, taskId, isRead, page = 1, pageSize = 20 } = ctx.query;
    const where: any = {};
    if (userId) where.userId = Number(userId);
    if (typeId) where.typeId = Number(typeId);
    if (taskId) where.taskId = Number(taskId);
    if (isRead !== undefined) where.isRead = Number(isRead);

    const { rows, count } = await ctx.model.NotificationMessage.findAndCountAll({
      where,
      include: [{ model: ctx.model.NotificationType, as: 'type', attributes: ['id', 'code', 'name'] }],
      offset: (Number(page) - 1) * Number(pageSize),
      limit: Number(pageSize),
      order: [['id', 'DESC']],
    });
    this.success({ list: rows, total: count, page: Number(page), pageSize: Number(pageSize) });
  }

  /** 消息详情，包含关联的渠道下发日志 */
  async detail() {
    const { ctx } = this;
    const id = Number(ctx.params.id);
    const msg = await ctx.model.NotificationMessage.findByPk(id, {
      include: [{ model: ctx.model.NotificationType, as: 'type', attributes: ['id', 'code', 'name'] }],
    });
    if (!msg) ctx.throw(404, '消息不存在');
    const sendLogs = await ctx.model.NotificationSendLog.findAll({
      where: { messageId: id }, order: [['id', 'ASC']],
    });
    this.success({ message: msg, sendLogs });
  }
}
