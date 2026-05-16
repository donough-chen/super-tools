import { Controller } from 'egg';
import { Op } from 'sequelize';

/**
 * Admin 通知类型管理
 */
export default class NotificationTypeController extends Controller {

  /**
   * 列表（支持关键词搜索 + 分类筛选 + 状态筛选）
   */
  async list() {
    const { ctx } = this;
    const { keyword, category, status, page = 1, pageSize = 20 } = ctx.query;
    const where: any = {};
    if (keyword) {
      where[Op.or] = [
        { code: { [Op.like]: `%${keyword}%` } },
        { name: { [Op.like]: `%${keyword}%` } },
      ];
    }
    if (category) where.category = category;
    if (status !== undefined) where.status = Number(status);

    const { rows, count } = await ctx.model.NotificationType.findAndCountAll({
      where,
      offset: (Number(page) - 1) * Number(pageSize),
      limit: Number(pageSize),
      order: [['sortOrder', 'ASC'], ['id', 'DESC']],
    });
    (ctx as any).success({ list: rows, total: count, page: Number(page), pageSize: Number(pageSize) });
  }

  /**
   * 创建
   */
  async create() {
    const { ctx } = this;
    const body = ctx.request.body as any;

    // 检查 code 唯一
    const exists = await ctx.model.NotificationType.findOne({ where: { code: body.code } });
    if (exists) {
      ctx.throw(409, `typeCode ${body.code} 已存在`);
    }

    const row = await ctx.model.NotificationType.create({
      code: body.code,
      name: body.name,
      description: body.description || null,
      category: body.category,
      defaultChannels: body.defaultChannels || ['in_app'],
      userCancelable: body.userCancelable ?? 1,
      priority: body.priority ?? 2,
      icon: body.icon || null,
      color: body.color || null,
      status: body.status ?? 1,
      sortOrder: body.sortOrder ?? 0,
      isSystem: 0,
    });
    (ctx as any).success(row);
  }

  /**
   * 更新
   */
  async update() {
    const { ctx } = this;
    const id = Number(ctx.params.id);
    const row = await ctx.model.NotificationType.findByPk(id);
    if (!row) ctx.throw(404, '通知类型不存在');

    // 系统内置类型限制修改字段
    const body = ctx.request.body as any;
    if ((row as any).isSystem && (body.code || body.category)) {
      ctx.throw(400, '系统内置类型不可修改 code 和 category');
    }

    await row.update(body);
    (ctx as any).success(row);
  }

  /**
   * 删除（软删除）
   */
  async destroy() {
    const { ctx } = this;
    const id = Number(ctx.params.id);
    const row = await ctx.model.NotificationType.findByPk(id);
    if (!row) ctx.throw(404, '通知类型不存在');

    if ((row as any).isSystem) {
      ctx.throw(400, '系统内置类型不可删除');
    }

    // 检查是否有关联模板
    const templateCount = await ctx.model.NotificationTemplate.count({ where: { typeId: id } });
    if (templateCount > 0) {
      ctx.throw(400, '该类型仍有关联模板，请先停用或删除模板');
    }

    await row.destroy();
    (ctx as any).success();
  }
}
