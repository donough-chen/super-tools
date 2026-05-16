import { Controller } from 'egg';

/**
 * Admin 通知任务管理
 * P1 仅支持 immediate 立即发送
 */
export default class NotificationTaskController extends Controller {

  async list() {
    const { ctx } = this;
    const { status, typeId, source, page = 1, pageSize = 20 } = ctx.query;
    const where: any = {};
    if (status) where.status = status;
    if (typeId) where.typeId = Number(typeId);
    if (source) where.source = source;

    const { rows, count } = await ctx.model.NotificationTask.findAndCountAll({
      where,
      offset: (Number(page) - 1) * Number(pageSize),
      limit: Number(pageSize),
      order: [['id', 'DESC']],
    });
    (ctx as any).success({ list: rows, total: count, page: Number(page), pageSize: Number(pageSize) });
  }

  async detail() {
    const { ctx } = this;
    const id = Number(ctx.params.id);
    const task = await ctx.model.NotificationTask.findByPk(id);
    if (!task) ctx.throw(404, '任务不存在');
    (ctx as any).success({ task });
  }

  async create() {
    const { ctx } = this;
    const body = ctx.request.body as any;

    const type = await ctx.model.NotificationType.findByPk(body.typeId);
    if (!type) ctx.throw(404, '通知类型不存在');

    const adminUser = (ctx as any).adminUser || (ctx as any).state?.user;

    const task = await ctx.model.NotificationTask.create({
      name: body.name || `手动任务-${new Date().toISOString()}`,
      description: body.description || null,
      typeId: body.typeId,
      templateCode: body.templateCode || (type as any).code,
      channels: body.channels || (type as any).defaultChannels,
      audienceId: body.audienceId || null,
      audienceSnapshot: body.audienceType === 'static'
        ? { userIds: body.staticUserIds || [] }
        : null,
      variables: body.variables || {},
      scheduleType: 'immediate',
      priority: body.priority ?? (type as any).priority ?? 2,
      status: 'running',
      source: 'admin',
      createdBy: adminUser?.id || null,
      startedAt: new Date(),
    });

    // 异步执行
    this._runTask(task, type, body).catch((e) => {
      ctx.logger.error(`[notif.task] task ${task.id} run failed: ${e.message}`);
    });

    (ctx as any).success(task);
  }

  private async _runTask(task: any, type: any, body: any) {
    const ctx = this.app.createAnonymousContext();
    try {
      const r = await ctx.service.notification.sendByAudience({
        typeCode: type.code,
        audienceType: body.audienceType || 'static',
        staticUserIds: body.staticUserIds || [],
        variables: body.variables || {},
        channels: task.channels,
        taskId: task.id,
      });
      await task.update({
        status: 'completed',
        finishedAt: new Date(),
        totalCount: r.totalUsers,
        successCount: r.totalMessages,
        skippedCount: r.skippedCount || 0,
      });
    } catch (e: any) {
      await task.update({
        status: 'failed',
        finishedAt: new Date(),
        errorMessage: e.message?.substring(0, 500),
      });
    }
  }
}
