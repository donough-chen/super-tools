import BaseController from '../../base';

export default class NotificationTaskController extends BaseController {

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
    this.success({ list: rows, total: count, page: Number(page), pageSize: Number(pageSize) });
  }

  async detail() {
    const { ctx } = this;
    const id = Number(ctx.params.id);
    const task = await ctx.model.NotificationTask.findByPk(id);
    if (!task) ctx.throw(404, '任务不存在');
    this.success({ task });
  }

  async create() {
    const { ctx } = this;
    const body = ctx.request.body as any;
    const type = await ctx.model.NotificationType.findByPk(body.typeId);
    if (!type) ctx.throw(404, '通知类型不存在');
    const adminUser = (ctx as any).adminUser || (ctx as any).state?.user;

    if (!body.templateCode) ctx.throw(400, '请指定模板编码 templateCode');

    // 若传了 audienceId，从受众分组中读取受众配置
    let resolvedAudienceType = body.audienceType || 'static';
    let resolvedStaticUserIds = body.staticUserIds || [];
    let resolvedDynamicRules = body.dynamicRules || null;
    if (body.audienceId) {
      const audienceRow = await ctx.model.NotificationAudience.findByPk(body.audienceId);
      if (!audienceRow) ctx.throw(404, '受众分组不存在');
      const ag = audienceRow as any;
      resolvedAudienceType = ag.audienceType;
      resolvedStaticUserIds = ag.staticUserIds || [];
      resolvedDynamicRules = ag.dynamicRules || null;
    }

    const task = await ctx.model.NotificationTask.create({
      name: body.name || `手动任务-${new Date().toISOString()}`,
      description: body.description || null, typeId: body.typeId,
      templateCode: body.templateCode,
      channels: body.channels || (type as any).defaultChannels,
      audienceId: body.audienceId || null,
      audienceSnapshot: resolvedAudienceType === 'static' ? { userIds: resolvedStaticUserIds } : null,
      variables: body.variables || {}, scheduleType: 'immediate',
      priority: body.priority ?? (type as any).priority ?? 2,
      status: 'running', source: 'admin',
      createdBy: adminUser?.id || null, startedAt: new Date(),
    });

    this._runTask(task, type, { ...body, audienceType: resolvedAudienceType, staticUserIds: resolvedStaticUserIds, dynamicRules: resolvedDynamicRules }).catch((e) => {
      ctx.logger.error(`[notif.task] task ${task.id} run failed: ${e.message}`);
    });
    this.success(task);
  }

  private async _runTask(task: any, type: any, body: any) {
    const ctx = this.app.createAnonymousContext();
    try {
      const r = await (ctx.service.notification as any).core.sendByAudience({
        typeCode: type.code, audienceType: body.audienceType || 'static',
        staticUserIds: body.staticUserIds || [], dynamicRules: body.dynamicRules || null,
        variables: body.variables || {}, channels: task.channels, taskId: task.id,
      });
      await task.update({
        status: 'completed', finishedAt: new Date(),
        totalCount: r.totalUsers, successCount: r.totalMessages, skippedCount: r.skippedCount || 0,
      });
    } catch (e: any) {
      await task.update({
        status: 'failed', finishedAt: new Date(), errorMessage: e.message?.substring(0, 500),
      });
    }
  }

  async createScheduled() {
    const { ctx } = this;
    const body = ctx.request.body as any;
    const adminUser = (ctx as any).adminUser || (ctx as any).state?.user;
    const type = await ctx.model.NotificationType.findByPk(body.typeId);
    if (!type) ctx.throw(404, '通知类型不存在');
    if (!body.templateCode) ctx.throw(400, '请指定模板编码 templateCode');

    // 若传了 audienceId，从受众分组中读取受众配置
    let resolvedAudienceType = body.audienceType || 'static';
    let resolvedStaticUserIds = body.staticUserIds;
    let resolvedDynamicRules = body.dynamicRules;
    if (body.audienceId) {
      const audienceRow = await ctx.model.NotificationAudience.findByPk(body.audienceId);
      if (!audienceRow) ctx.throw(404, '受众分组不存在');
      const ag = audienceRow as any;
      resolvedAudienceType = ag.audienceType;
      resolvedStaticUserIds = ag.staticUserIds || [];
      resolvedDynamicRules = ag.dynamicRules || null;
    }

    const task = await (ctx.service.notification as any).taskScheduler.createAndSchedule({
      name: body.name || `调度任务-${new Date().toISOString()}`,
      typeId: body.typeId, templateCode: body.templateCode,
      channels: body.channels || (type as any).defaultChannels,
      audienceType: resolvedAudienceType, staticUserIds: resolvedStaticUserIds,
      dynamicRules: resolvedDynamicRules,
      variables: body.variables || {}, sendType: body.sendType || 'immediate',
      scheduledAt: body.scheduledAt, cronExpression: body.cronExpression, rrule: body.rrule,
      undoWindowSec: body.undoWindowSec || 0,
      priority: body.priority ?? (type as any).priority ?? 2,
      description: body.description, createdBy: adminUser?.id,
    });
    this.success(task);
  }

  async pause() {
    const { ctx } = this;
    const task = await (ctx.service.notification as any).taskScheduler.pause(Number(ctx.params.id));
    this.success(task);
  }

  async resume() {
    const { ctx } = this;
    const task = await (ctx.service.notification as any).taskScheduler.resume(Number(ctx.params.id));
    this.success(task);
  }

  async cancel() {
    const { ctx } = this;
    const task = await (ctx.service.notification as any).taskScheduler.cancel(Number(ctx.params.id));
    this.success(task);
  }

  async undo() {
    const { ctx } = this;
    const task = await (ctx.service.notification as any).taskScheduler.undo(Number(ctx.params.id));
    this.success(task);
  }
}
