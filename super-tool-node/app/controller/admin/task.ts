import BaseController from '../base';

/**
 * 任务管理控制器（管理端）
 *  设计依据: docs/superpowers/plans/2026-05-26-积分成长体系MVP实施计划-v2.md §Task 16
 *
 *  路由（路由注册见 router.ts）：
 *    GET    /api/admin/points/tasks?category&status&page&pageSize
 *    POST   /api/admin/points/tasks
 *    PUT    /api/admin/points/tasks/:id
 *    DELETE /api/admin/points/tasks/:id
 */
export default class AdminTaskController extends BaseController {
  /** GET /api/admin/points/tasks */
  async list() {
    const { ctx } = this;
    const where: any = {};
    if (ctx.query.category) where.category = ctx.query.category;
    if (ctx.query.status !== undefined && ctx.query.status !== '') {
      where.status = Number(ctx.query.status);
    }
    const page = Number(ctx.query.page) || 1;
    const pageSize = Math.min(Number(ctx.query.pageSize) || 20, 100);
    const r: any = await ctx.model.Task.findAndCountAll({
      where,
      order: [['sort', 'ASC'], ['id', 'ASC']],
      limit: pageSize,
      offset: (page - 1) * pageSize,
    });
    this.success({ list: r.rows, total: r.count, page, pageSize });
  }

  /** POST /api/admin/points/tasks */
  async create() {
    const { ctx } = this;
    const body: any = ctx.request.body;
    if (!body.code || !body.name || !body.triggerEvent) {
      ctx.throw(400, 'code/name/triggerEvent 必填');
    }
    const t = await ctx.model.Task.create(body);
    this.success(t);
  }

  /** PUT /api/admin/points/tasks/:id */
  async update() {
    const { ctx } = this;
    const t: any = await ctx.model.Task.findByPk(ctx.params.id);
    if (!t) ctx.throw(404, '任务不存在');
    await t.update(ctx.request.body);
    this.success(t);
  }

  /** DELETE /api/admin/points/tasks/:id */
  async destroy() {
    const { ctx } = this;
    await ctx.model.Task.destroy({ where: { id: ctx.params.id } });
    this.success({ deleted: true });
  }
}
