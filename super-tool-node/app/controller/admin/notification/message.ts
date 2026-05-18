import BaseController from '../../base';

export default class NotificationMessageController extends BaseController {

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
