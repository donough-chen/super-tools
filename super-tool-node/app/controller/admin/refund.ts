import BaseController from '../base';

/**
 * 管理端退款 Controller — Phase 2
 * 路由前缀: /api/admin/member
 *
 * 3 个方法：
 *   - POST /api/admin/member/orders/:id/refund — 发起退款（perm: member:refund:create）
 *   - GET  /api/admin/member/refunds            — 退款列表（perm: member:order:list 复用）
 *   - GET  /api/admin/member/refunds/:id        — 退款详情（perm: member:order:detail 复用）
 *
 * 注意：service.refund.create 内部已写 audit + 通知；controller 这里不再 log。
 *      若 service throw 400/500，错误也已包含足够信息，框架统一 errorHandler 处理即可。
 */
export default class AdminRefundController extends BaseController {
  /** POST /api/admin/member/orders/:id/refund — 发起退款 */
  async create() {
    this.validate({ reason: { type: 'string', required: true, max: 200 } });
    const orderId = Number(this.ctx.params.id);
    const operatorId = (this.ctx.state.user as any).id;
    const { reason } = this.ctx.request.body;
    const data = await this.service.refund.create({ orderId, reason, operatorId });
    this.success(data, '退款已成功');
  }

  /** GET /api/admin/member/refunds — 退款列表（含筛选） */
  async list() {
    const pagination = this.getPagination();
    const { orderId, userId, status, startDate, endDate } = this.ctx.query;
    const result = await this.service.refund.listAll({
      ...pagination,
      orderId: orderId ? Number(orderId) : undefined,
      userId: userId ? Number(userId) : undefined,
      status: status !== undefined ? Number(status) : undefined,
      startDate: startDate as string,
      endDate: endDate as string,
    });
    this.paginated(result);
  }

  /** GET /api/admin/member/refunds/:id — 退款详情 */
  async detail() {
    const data = await this.service.refund.detail(Number(this.ctx.params.id));
    this.success(data);
  }
}
