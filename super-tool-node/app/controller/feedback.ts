import BaseController from './base';

const VALID_TYPES = ['bug', 'suggestion', 'praise', 'other'];

export default class FeedbackController extends BaseController {
  /**
   * POST /api/feedback
   * - 可登录可不登录（手动解析 token）
   * - 限流 10 req/h/IP（在 router 层挂载）
   * - 未登录用户必须填 contact
   * - 不挂 audit（C 端行为不审计）
   */
  async create() {
    // 1. 可选 token 解析（宽松模式：JWT 验签通过即接受 userId，不查 session）
    let userId: number | null = null;
    const auth = this.ctx.get('authorization');
    if (auth) {
      const token = auth.replace(/^Bearer\s+/i, '');
      if (token) {
        try {
          const decoded = (this.app as any).jwt.verify(
            token,
            ((this.app.config as any).jwt as any).secret,
          ) as any;
          userId = decoded?.userId ?? null;
        } catch { /* 无效/过期 token → 按匿名 */ }
      }
    }

    // 2. 参数校验
    this.validate({
      type: { type: 'enum', values: VALID_TYPES },
      content: { type: 'string', min: 5, max: 2000 },
      contact: { type: 'string', required: false, max: 100 },
      platform: { type: 'string', required: false, max: 30 },
    });

    const body = this.ctx.request.body as any;

    // 3. 未登录强制留联系方式
    if (!userId && !body.contact) {
      this.ctx.throw(422, '未登录用户必须填写联系方式');
    }

    // 4. 写入
    const fb = await this.service.feedback.create({
      userId,
      type: body.type,
      content: body.content,
      contact: body.contact || null,
      platform: body.platform || null,
      ip: this.ctx.ip,
      userAgent: this.ctx.get('user-agent'),
    });
    this.created({ id: (fb as any).id });
  }

  /**
   * GET /api/feedback/mine
   * - 需登录（router 层挂 auth 中间件）
   * - 返回当前用户的反馈列表（分页 + 可选状态筛选）
   */
  async myList() {
    const userId = (this.ctx.state as any).user?.id;
    if (!userId) this.ctx.throw(401, '请先登录');

    const q = this.ctx.query as any;
    const result = await this.service.feedback.myList(userId, {
      page: q.page ? Number(q.page) : undefined,
      pageSize: q.pageSize ? Number(q.pageSize) : undefined,
      status: q.status !== undefined && q.status !== ''
        ? Number(q.status) as 0 | 1 | 2 | 3
        : undefined,
    });
    this.success(result);
  }

  /**
   * GET /api/feedback/mine/:id
   * - 需登录
   * - 仅能查看自己的反馈（service 层校验 userId）
   */
  async myDetail() {
    const userId = (this.ctx.state as any).user?.id;
    if (!userId) this.ctx.throw(401, '请先登录');

    const id = Number(this.ctx.params.id);
    const data = await this.service.feedback.myDetail(id, userId);
    this.success(data);
  }
}
