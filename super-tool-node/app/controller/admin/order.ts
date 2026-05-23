import BaseController from '../base';

/**
 * 管理端订单 Controller
 * 路由前缀: /api/admin/member/orders
 *
 * 本 MVP 仅只读（list/detail/stats），不提供改单/退款写操作
 */
export default class AdminOrderController extends BaseController {
  /** GET /api/admin/member/orders — 全局订单列表 */
  async list() {
    const pagination = this.getPagination();
    const { userId, status, startDate, endDate } = this.ctx.query;
    const result = await this.service.order.listAll({
      ...pagination,
      userId: userId ? Number(userId) : undefined,
      status: status !== undefined ? Number(status) : undefined,
      startDate: startDate as string,
      endDate: endDate as string,
    });
    this.paginated(result);
  }

  /** GET /api/admin/member/orders/stats — 订单统计 */
  async stats() {
    const { startDate, endDate } = this.ctx.query;
    const data = await this.service.order.stats({
      startDate: startDate as string,
      endDate: endDate as string,
    });
    this.success(data);
  }

  /** GET /api/admin/member/orders/:id — 订单详情 */
  async detail() {
    const data = await this.service.order.detail(Number(this.ctx.params.id));
    this.success(data);
  }
}
