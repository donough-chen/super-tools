import { Controller } from 'egg';
import { renderTemplate } from '../../lib/templateRenderer';

/**
 * Admin 通知模板管理
 */
export default class NotificationTemplateController extends Controller {

  /**
   * 列表
   */
  async list() {
    const { ctx } = this;
    const { typeId, channel, status, page = 1, pageSize = 20 } = ctx.query;
    const where: any = {};
    if (typeId) where.typeId = Number(typeId);
    if (channel) where.channel = channel;
    if (status !== undefined) where.status = Number(status);

    const { rows, count } = await ctx.model.NotificationTemplate.findAndCountAll({
      where,
      include: [{ model: ctx.model.NotificationType, as: 'type', attributes: ['id', 'code', 'name'] }],
      offset: (Number(page) - 1) * Number(pageSize),
      limit: Number(pageSize),
      order: [['typeId', 'ASC'], ['channel', 'ASC'], ['currentVersion', 'DESC']],
    });
    (ctx as any).success({ list: rows, total: count, page: Number(page), pageSize: Number(pageSize) });
  }

  /**
   * 详情（含版本历史）
   */
  async detail() {
    const { ctx } = this;
    const id = Number(ctx.params.id);
    const tpl = await ctx.model.NotificationTemplate.findByPk(id, {
      include: [{ model: ctx.model.NotificationType, as: 'type', attributes: ['id', 'code', 'name'] }],
    });
    if (!tpl) ctx.throw(404, '模板不存在');

    const versions = await ctx.model.NotificationTemplateVersion.findAll({
      where: { templateId: id },
      order: [['version', 'DESC']],
    });
    (ctx as any).success({ template: tpl, versions });
  }

  /**
   * 创建草稿
   */
  async create() {
    const { ctx } = this;
    const body = ctx.request.body as any;
    const adminUser = (ctx as any).adminUser || (ctx as any).state?.user;
    const draft = await ctx.service.notificationTemplate.createDraft({
      typeId: body.typeId,
      code: body.code,
      name: body.name,
      channel: body.channel,
      titleTemplate: body.titleTemplate,
      contentTemplate: body.contentTemplate,
      extraConfig: body.extraConfig,
      sampleVariables: body.sampleVariables,
      description: body.description,
      operatorId: adminUser?.id || 0,
    });
    (ctx as any).success(draft);
  }

  /**
   * 更新草稿
   */
  async update() {
    const { ctx } = this;
    const id = Number(ctx.params.id);
    const tpl = await ctx.model.NotificationTemplate.findByPk(id);
    if (!tpl) ctx.throw(404, '模板不存在');
    if ((tpl as any).status === 1) {
      ctx.throw(400, '已发布的模板不可直接修改，请创建新草稿');
    }

    const body = ctx.request.body as any;
    const adminUser = (ctx as any).adminUser || (ctx as any).state?.user;
    await tpl.update({ ...body, updatedBy: adminUser?.id || 0 });
    (ctx as any).success(tpl);
  }

  /**
   * 发布
   */
  async publish() {
    const { ctx } = this;
    const id = Number(ctx.params.id);
    const adminUser = (ctx as any).adminUser || (ctx as any).state?.user;
    const tpl = await ctx.service.notificationTemplate.publishVersion({
      templateId: id,
      operatorId: adminUser?.id || 0,
      changeNote: (ctx.request.body as any)?.changeNote,
    });
    (ctx as any).success(tpl);
  }

  /**
   * 预览渲染（不实际发送）
   */
  async preview() {
    const { ctx } = this;
    const id = Number(ctx.params.id);
    const tpl = await ctx.model.NotificationTemplate.findByPk(id);
    if (!tpl) ctx.throw(404, '模板不存在');

    const variables = (ctx.request.body as any)?.variables || {};
    const t = tpl as any;
    const titleResult = t.titleTemplate
      ? renderTemplate(t.titleTemplate, variables)
      : { result: '', missingVars: [], warnings: [] };
    const contentResult = renderTemplate(t.contentTemplate, variables);

    (ctx as any).success({
      title: titleResult.result,
      content: contentResult.result,
      missingVars: [...titleResult.missingVars, ...contentResult.missingVars],
    });
  }

  /**
   * 测试发送（发给指定用户或当前管理员）
   */
  async testSend() {
    const { ctx } = this;
    const id = Number(ctx.params.id);
    const tpl = await ctx.model.NotificationTemplate.findByPk(id);
    if (!tpl) ctx.throw(404, '模板不存在');

    const type = await ctx.model.NotificationType.findByPk((tpl as any).typeId);
    if (!type) ctx.throw(404, '关联类型不存在');

    const body = ctx.request.body as any;
    const adminUser = (ctx as any).adminUser || (ctx as any).state?.user;
    const targetUserId = body.userId || adminUser?.id;
    const variables = body.variables || {};

    const r = await ctx.service.notification.sendDirect({
      typeCode: (type as any).code,
      userId: targetUserId,
      variables,
      channels: [(tpl as any).channel],
    });
    (ctx as any).success(r);
  }

  /**
   * P2.4: 回滚到指定历史版本
   */
  async rollback() {
    const { ctx } = this;
    const templateId = Number(ctx.params.id);
    const versionId = Number(ctx.params.versionId);
    const adminUser = (ctx as any).adminUser || (ctx as any).state?.user;

    const result = await ctx.service.notificationTemplate.rollbackToVersion({
      templateId,
      versionId,
      operatorId: adminUser?.id || 0,
    });
    (ctx as any).success(result);
  }
}
