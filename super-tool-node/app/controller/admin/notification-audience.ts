import { Controller } from 'egg';

/**
 * Admin 受众分组管理
 */
export default class NotificationAudienceController extends Controller {

  async list() {
    const { ctx } = this;
    const { audienceType, page = 1, pageSize = 20 } = ctx.query;
    const where: any = {};
    if (audienceType) where.audienceType = audienceType;

    const { rows, count } = await ctx.model.NotificationAudience.findAndCountAll({
      where,
      offset: (Number(page) - 1) * Number(pageSize),
      limit: Number(pageSize),
      order: [['id', 'DESC']],
    });
    (ctx as any).success({ list: rows, total: count });
  }

  async detail() {
    const { ctx } = this;
    const id = Number(ctx.params.id);
    const audience = await ctx.model.NotificationAudience.findByPk(id);
    if (!audience) ctx.throw(404, '受众分组不存在');
    (ctx as any).success(audience);
  }

  async create() {
    const { ctx } = this;
    const body = ctx.request.body as any;
    const adminUser = (ctx as any).adminUser || (ctx as any).state?.user;
    const row = await ctx.model.NotificationAudience.create({
      name: body.name,
      code: body.code || null,
      description: body.description || null,
      audienceType: body.audienceType,
      staticUserIds: body.staticUserIds || null,
      dynamicRules: body.dynamicRules || null,
      createdBy: adminUser?.id || 0,
    });
    (ctx as any).success(row);
  }

  async update() {
    const { ctx } = this;
    const id = Number(ctx.params.id);
    const row = await ctx.model.NotificationAudience.findByPk(id);
    if (!row) ctx.throw(404, '受众分组不存在');
    await row.update(ctx.request.body as any);
    (ctx as any).success(row);
  }

  async destroy() {
    const { ctx } = this;
    const id = Number(ctx.params.id);
    const row = await ctx.model.NotificationAudience.findByPk(id);
    if (!row) ctx.throw(404, '受众分组不存在');
    await row.destroy();
    (ctx as any).success();
  }

  /**
   * 受众预览（不保存，直接试算）
   */
  async preview() {
    const { ctx } = this;
    const body = ctx.request.body as any;
    if (!body.dynamicRules) ctx.throw(400, '请提供动态规则');
    const result = await ctx.service.notificationAudience.previewDynamic(body.dynamicRules, 100);
    (ctx as any).success(result);
  }

  /**
   * 获取字段白名单（前端 RuleBuilder 用）
   */
  async fieldWhitelist() {
    const { ctx } = this;
    const fields = ctx.service.notificationAudience.getFieldWhitelist();
    (ctx as any).success(fields);
  }
}
