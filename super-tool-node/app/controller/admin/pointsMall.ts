import BaseController from '../base';
import { pickFields } from '../../lib/pickFields';

/**
 * 积分商城管理控制器（管理端）
 *  设计依据: docs/superpowers/plans/2026-05-26-积分成长体系MVP实施计划-v2.md §Task 16
 *           docs/superpowers/specs/2026-05-27-积分成长体系后端优化设计文档.md §2.10-#31
 *
 *  路由（注册见 router.ts）：
 *    GET    /api/admin/points/mall/items?category&status
 *    POST   /api/admin/points/mall/items
 *    PUT    /api/admin/points/mall/items/:id
 *    GET    /api/admin/points/mall/orders?fulfillStatus&refundStatus&userId
 *    POST   /api/admin/points/mall/orders/:id/refund   body: { reason }
 *
 *  B8（spec §2.10-#31）：createItem/updateItem 增字段白名单防注入。
 *    复用 app/lib/pickFields（B7 已落地）。
 *    与 B7 不同：mall_items 没有 task.code 那种 immutable 业务键，
 *    所以 CREATE/UPDATE 共用单一 ITEM_FIELDS 白名单。
 */

/** 积分商城商品 创建/更新 字段白名单（共用单白名单） */
const ITEM_FIELDS = [
  'name',
  'icon',
  'description',
  'category',
  'costPoints',
  'requiredLevel',
  'isVirtual',
  'fulfillConfig',
  'stock',
  'dailyLimit',
  'totalLimit',
  'validFrom',
  'validTo',
  'sort',
  'status',
] as const;

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
    const body: any = pickFields(ctx.request.body, ITEM_FIELDS);
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
    const body = pickFields(ctx.request.body, ITEM_FIELDS);
    await t.update(body);
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
