import BaseController from '../../base';

export default class NotificationAudienceController extends BaseController {

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
    this.success({ list: rows, total: count });
  }

  async detail() {
    const { ctx } = this;
    const audience = await ctx.model.NotificationAudience.findByPk(Number(ctx.params.id));
    if (!audience) ctx.throw(404, '受众分组不存在');
    this.success(audience);
  }

  async create() {
    const { ctx } = this;
    const body = ctx.request.body as any;
    const adminUser = (ctx as any).adminUser || (ctx as any).state?.user;
    const row = await ctx.model.NotificationAudience.create({
      name: body.name, code: body.code || null, description: body.description || null,
      audienceType: body.audienceType, staticUserIds: body.staticUserIds || null,
      dynamicRules: body.dynamicRules || null, createdBy: adminUser?.id || 0,
    });
    this.success(row);
  }

  async update() {
    const { ctx } = this;
    const row = await ctx.model.NotificationAudience.findByPk(Number(ctx.params.id));
    if (!row) ctx.throw(404, '受众分组不存在');
    await row.update(ctx.request.body as any);
    this.success(row);
  }

  async destroy() {
    const { ctx } = this;
    const row = await ctx.model.NotificationAudience.findByPk(Number(ctx.params.id));
    if (!row) ctx.throw(404, '受众分组不存在');
    await row.destroy();
    this.success();
  }

  async preview() {
    const { ctx } = this;
    const body = ctx.request.body as any;
    if (!body.dynamicRules) ctx.throw(400, '请提供动态规则');
    const result = await (ctx.service.notification as any).audience.previewDynamic(body.dynamicRules, 100);
    this.success(result);
  }

  async fieldWhitelist() {
    const { ctx } = this;
    const fields = (ctx.service.notification as any).audience.getFieldWhitelist();
    this.success(fields);
  }
}
