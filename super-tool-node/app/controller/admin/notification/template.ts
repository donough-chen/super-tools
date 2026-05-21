/**
 * @file 管理端 - 通知模板控制器
 * @description 管理通知模板的 CRUD、发布、预览、测试发送和版本回滚。
 *              模板生命周期：草稿(0) → 已发布(1) → 已停用(2)。
 *              发布时自动生成版本快照，支持回滚到历史版本。
 * @module controller/admin/notification/template
 */
import BaseController from '../../base';
import { renderTemplate } from '../../../lib/templateRenderer';

export default class NotificationTemplateController extends BaseController {

  /** 模板列表（分页），支持按类型/渠道/状态筛选 */
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
    this.success({ list: rows, total: count, page: Number(page), pageSize: Number(pageSize) });
  }

  /** 模板详情，同时返回所有历史版本快照 */
  async detail() {
    const { ctx } = this;
    const id = Number(ctx.params.id);
    const tpl = await ctx.model.NotificationTemplate.findByPk(id, {
      include: [{ model: ctx.model.NotificationType, as: 'type', attributes: ['id', 'code', 'name'] }],
    });
    if (!tpl) ctx.throw(404, '模板不存在');
    const versions = await ctx.model.NotificationTemplateVersion.findAll({
      where: { templateId: id }, order: [['version', 'DESC']],
    });
    this.success({ template: tpl, versions });
  }

  /** 创建草稿模板 */
  async create() {
    const { ctx } = this;
    const body = ctx.request.body as any;
    const adminUser = (ctx as any).adminUser || (ctx as any).state?.user;
    const draft = await (ctx.service.notification as any).template.createDraft({
      typeId: body.typeId, code: body.code, name: body.name, channel: body.channel,
      titleTemplate: body.titleTemplate, contentTemplate: body.contentTemplate,
      extraConfig: body.extraConfig, sampleVariables: body.sampleVariables,
      description: body.description, operatorId: adminUser?.id || 0,
    });
    this.success(draft);
  }

  /** 更新草稿模板（已发布状态不可直接修改） */
  async update() {
    const { ctx } = this;
    const id = Number(ctx.params.id);
    const tpl = await ctx.model.NotificationTemplate.findByPk(id);
    if (!tpl) ctx.throw(404, '模板不存在');
    if ((tpl as any).status === 1) ctx.throw(400, '已发布的模板不可直接修改，请创建新草稿');
    const body = ctx.request.body as any;
    const adminUser = (ctx as any).adminUser || (ctx as any).state?.user;
    await tpl.update({ ...body, updatedBy: adminUser?.id || 0 });
    this.success(tpl);
  }

  /**
   * 发布模板
   * 将草稿状态变为已发布，同时停用同类型同渠道的旧模板，生成版本快照
   */
  async publish() {
    const { ctx } = this;
    const id = Number(ctx.params.id);
    const adminUser = (ctx as any).adminUser || (ctx as any).state?.user;
    const tpl = await (ctx.service.notification as any).template.publishVersion({
      templateId: id, operatorId: adminUser?.id || 0,
      changeNote: (ctx.request.body as any)?.changeNote,
    });
    this.success(tpl);
  }

  /**
   * 预览模板渲染结果
   * 传入变量后返回渲染后的标题和正文，以及缺失变量列表
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
    this.success({
      title: titleResult.result, content: contentResult.result,
      missingVars: [...titleResult.missingVars, ...contentResult.missingVars],
    });
  }

  /**
   * 测试发送
   * 使用指定模板向目标用户发送一条真实通知（用于验证模板效果）
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
    const r = await (ctx.service.notification as any).core.sendDirect({
      typeCode: (type as any).code, userId: body.userId || adminUser?.id,
      variables: body.variables || {}, channels: [(tpl as any).channel],
    });
    this.success(r);
  }

  /**
   * 版本回滚
   * 将模板内容回滚到指定历史版本，同时备份当前版本
   */
  async rollback() {
    const { ctx } = this;
    const templateId = Number(ctx.params.id);
    const versionId = Number(ctx.params.versionId);
    const adminUser = (ctx as any).adminUser || (ctx as any).state?.user;
    const result = await (ctx.service.notification as any).template.rollbackToVersion({
      templateId, versionId, operatorId: adminUser?.id || 0,
    });
    this.success(result);
  }
}
