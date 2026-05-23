import BaseController from './base';

/**
 * C 端订单 Controller
 * 路由前缀: /api/orders
 */
export default class OrderController extends BaseController {
  /** POST /api/orders — 创建订单 */
  async create() {
    this.validate({ planCode: { type: 'string', required: true } });
    const userId = (this.ctx.state.user as any).id;
    const { planCode, remark } = this.ctx.request.body;
    const data = await this.service.order.create({ userId, planCode, remark });
    this.success(data, '下单成功');
  }

  /** POST /api/orders/preview — 预览订单（dryRun，Phase 2 新增） */
  async preview() {
    this.validate({ planCode: { type: 'string', required: true } });
    const userId = (this.ctx.state.user as any).id;
    const { planCode } = this.ctx.request.body;
    const data = await this.service.order.preview({ userId, planCode });
    this.success(data, '预览成功');
  }

  /** GET /api/orders — 我的订单列表 */
  async list() {
    const userId = (this.ctx.state.user as any).id;
    const pagination = this.getPagination();
    const { status } = this.ctx.query;
    const result = await this.service.order.listByUser(userId, {
      ...pagination,
      status: status !== undefined ? Number(status) : undefined,
    });
    this.paginated(result);
  }

  /** GET /api/orders/:id — 订单详情 */
  async detail() {
    const userId = (this.ctx.state.user as any).id;
    const data = await this.service.order.detail(Number(this.ctx.params.id), userId);
    this.success(data);
  }

  /** POST /api/orders/:id/cancel — 取消订单 */
  async cancel() {
    const userId = (this.ctx.state.user as any).id;
    const data = await this.service.order.cancel(Number(this.ctx.params.id), userId);
    this.success(data, '已取消');
  }
}
