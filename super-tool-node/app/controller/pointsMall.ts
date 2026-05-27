import BaseController from './base';

/**
 * 积分商城控制器（C 端）
 *  设计依据: docs/superpowers/plans/2026-05-26-积分成长体系MVP实施计划-v2.md §Task 15
 *
 *  路由：
 *    GET  /api/points-mall/items?category=...   商品列表
 *    POST /api/points-mall/exchange             兑换（带 Idempotency-Key + rateLimit 5/min）
 *    GET  /api/points-mall/orders?page&pageSize 我的兑换记录
 */
export default class PointsMallController extends BaseController {
  /** GET /api/points-mall/items */
  async items() {
    const { ctx } = this;
    const list = await (ctx.service as any).pointsMall.listItems({
      category: ctx.query.category as string,
    });
    this.success(list);
  }

  /** POST /api/points-mall/exchange  body: { itemId, deliveryInfo? } */
  async exchange() {
    const { ctx } = this;
    const userId = (ctx.state.user as any).id;
    const { itemId, deliveryInfo } = ctx.request.body;
    if (!itemId) ctx.throw(400, 'itemId 必填');
    const result = await (ctx.service as any).pointsMall.exchange(
      userId,
      Number(itemId),
      deliveryInfo,
    );
    this.success(result);
  }

  /** GET /api/points-mall/orders?page&pageSize */
  async orders() {
    const { ctx } = this;
    const userId = (ctx.state.user as any).id;
    const page = Number(ctx.query.page) || 1;
    const pageSize = Math.min(Number(ctx.query.pageSize) || 20, 100);
    const result: any = await (ctx.service as any).pointsMall.listMyOrders(userId, {
      page,
      pageSize,
    });
    this.success({
      list: (result.rows || []).map((o: any) => ({
        orderNo: o.orderNo,
        itemName: o.productSnapshot?.name,
        costPoints: o.costPoints,
        fulfillStatus: o.fulfillStatus,
        refundStatus: o.refundStatus,
        createdAt: o.createdAt,
      })),
      total: result.count || 0,
      page,
      pageSize,
    });
  }
}
