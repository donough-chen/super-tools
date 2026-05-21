/**
 * @file 管理端 - 发送任务控制器
 * @description 管理通知发送任务的完整生命周期：创建即时/定时/周期任务、暂停、恢复、取消、撤销。
 *              即时任务创建后立即异步执行；定时/周期任务通过 taskScheduler 服务调度。
 *              状态机：pending → queued → running → completed | paused | cancelled | failed
 * @module controller/admin/notification/task
 */
import BaseController from '../../base';

export default class NotificationTaskController extends BaseController {

  /** 任务列表（分页），支持按状态/类型/来源筛选 */
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

  /** 任务详情 */
  async detail() {
    const { ctx } = this;
    const id = Number(ctx.params.id);
    const task = await ctx.model.NotificationTask.findByPk(id);
    if (!task) ctx.throw(404, '任务不存在');
    this.success({ task });
  }

  /**
   * 创建即时发送任务
   * 1. 校验通知类型和模板编码
   * 2. 若指定 audienceId 则从受众分组读取配置
   * 3. 创建任务记录后异步执行 _runTask（不阻塞响应）
   */
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

  /**
   * 异步执行任务（后台运行）
   * 调用 core.sendByAudience 逐用户发送，完成后更新任务统计
   */
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

  /**
   * 创建定时/周期任务
   * 支持 immediate(带撤销窗口)、scheduled(定时)、cron(周期)、rrule(复杂周期) 四种模式
   * 通过 taskScheduler 服务管理调度生命周期
   */
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

  /** 暂停任务（仅 running/scheduled 状态可暂停） */
  async pause() {
    const { ctx } = this;
    const task = await (ctx.service.notification as any).taskScheduler.pause(Number(ctx.params.id));
    this.success(task);
  }

  /** 恢复已暂停的任务 */
  async resume() {
    const { ctx } = this;
    const task = await (ctx.service.notification as any).taskScheduler.resume(Number(ctx.params.id));
    this.success(task);
  }

  /** 取消任务（已完成/已取消的不可再取消） */
  async cancel() {
    const { ctx } = this;
    const task = await (ctx.service.notification as any).taskScheduler.cancel(Number(ctx.params.id));
    this.success(task);
  }

  /** 撤销任务（仅限带撤销窗口的即时任务，且在窗口期内） */
  async undo() {
    const { ctx } = this;
    const task = await (ctx.service.notification as any).taskScheduler.undo(Number(ctx.params.id));
    this.success(task);
  }
}
