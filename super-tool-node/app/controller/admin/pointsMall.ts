import BaseController from '../base';

/**
 * 积分商城管理控制器（管理端）
 *  设计依据: docs/superpowers/plans/2026-05-26-积分成长体系MVP实施计划-v2.md §Task 16
 *
 *  路由（注册见 router.ts）：
 *    GET    /api/admin/points/mall/items?category&status
 *    POST   /api/admin/points/mall/items
 *    PUT    /api/admin/points/mall/items/:id
 *    GET    /api/admin/points/mall/orders?fulfillStatus&refundStatus&userId
 *    POST   /api/admin/points/mall/orders/:id/refund   body: { reason }
 */
export default class AdminPointsMallController extends BaseController {
  /** GET /api/admin/points/mall/items */
  async items() {
    const { ctx } = this;
    const where: any = {};
    if (ctx.query.category) where.category = ctx.query.category;
    if (ctx.query.status !== undefined && ctx.query.status !== '') {
      where.status = Number(ctx.query.status);
    }
    const page = Number(ctx.query.page) || 1;
    const pageSize = Math.min(Number(ctx.query.pageSize) || 20, 100);
    const r: any = await ctx.model.PointsMallItem.findAndCountAll({
      where,
      order: [['sort', 'ASC']],
      limit: pageSize,
      offset: (page - 1) * pageSize,
    });
    this.success({ list: r.rows, total: r.count, page, pageSize });
  }

  /** POST /api/admin/points/mall/items */
  async createItem() {
    const { ctx } = this;
    const body: any = ctx.request.body;
    if (!body.name || !body.category || !body.costPoints || !body.fulfillConfig) {
      ctx.throw(400, 'name/category/costPoints/fulfillConfig 必填');
    }
    const t = await ctx.model.PointsMallItem.create(body);
    this.success(t);
  }

  /** PUT /api/admin/points/mall/items/:id */
  async updateItem() {
    const { ctx } = this;
    const t: any = await ctx.model.PointsMallItem.findByPk(ctx.params.id);
    if (!t) ctx.throw(404, '商品不存在');
    await t.update(ctx.request.body);
    this.success(t);
  }

  /** GET /api/admin/points/mall/orders */
  async orders() {
    const { ctx } = this;
    const where: any = {};
    if (ctx.query.fulfillStatus) where.fulfillStatus = ctx.query.fulfillStatus;
    if (ctx.query.refundStatus) where.refundStatus = ctx.query.refundStatus;
    if (ctx.query.userId) where.userId = Number(ctx.query.userId);
    const page = Number(ctx.query.page) || 1;
    const pageSize = Math.min(Number(ctx.query.pageSize) || 20, 100);
    const r: any = await ctx.model.PointsMallOrder.findAndCountAll({
      where,
      order: [['created_at', 'DESC']],
      limit: pageSize,
      offset: (page - 1) * pageSize,
    });
    this.success({ list: r.rows, total: r.count, page, pageSize });
  }

  /** POST /api/admin/points/mall/orders/:id/refund */
  async refundOrder() {
    const { ctx } = this;
    const id = Number(ctx.params.id);
    const reason = ((ctx.request.body as any)?.reason) || '管理员退款';
    const r = await (ctx.service as any).pointsMall.refund(id, reason);
    this.success(r);
  }
}
