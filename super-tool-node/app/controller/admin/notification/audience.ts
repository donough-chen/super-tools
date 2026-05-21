/**
 * @file 管理端 - 受众分组控制器
 * @description 管理通知受众分组的 CRUD、动态规则预览和字段白名单查询。
 *              支持三种受众类型：all(全量)、static(静态ID列表)、dynamic(动态规则圈选)。
 * @module controller/admin/notification/audience
 */
import BaseController from '../../base';

export default class NotificationAudienceController extends BaseController {

  /** 受众分组列表（分页），支持按类型筛选 */
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

  /** 受众分组详情 */
  async detail() {
    const { ctx } = this;
    const audience = await ctx.model.NotificationAudience.findByPk(Number(ctx.params.id));
    if (!audience) ctx.throw(404, '受众分组不存在');
    this.success(audience);
  }

  /** 创建受众分组 */
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

  /** 更新受众分组 */
  async update() {
    const { ctx } = this;
    const row = await ctx.model.NotificationAudience.findByPk(Number(ctx.params.id));
    if (!row) ctx.throw(404, '受众分组不存在');
    await row.update(ctx.request.body as any);
    this.success(row);
  }

  /** 删除受众分组 */
  async destroy() {
    const { ctx } = this;
    const row = await ctx.model.NotificationAudience.findByPk(Number(ctx.params.id));
    if (!row) ctx.throw(404, '受众分组不存在');
    await row.destroy();
    this.success();
  }

  /**
   * 预览动态规则命中用户
   * 传入 dynamicRules 后返回命中用户ID列表和总数（限制最多返回 100 条）
   */
  async preview() {
    const { ctx } = this;
    const body = ctx.request.body as any;
    if (!body.dynamicRules) ctx.throw(400, '请提供动态规则');
    const result = await (ctx.service.notification as any).audience.previewDynamic(body.dynamicRules, 100);
    this.success(result);
  }

  /** 获取动态规则支持的字段白名单（供前端规则构建器使用） */
  async fieldWhitelist() {
    const { ctx } = this;
    const fields = (ctx.service.notification as any).audience.getFieldWhitelist();
    this.success(fields);
  }
}
