import BaseController from '../base';

export default class AdminFeedbackController extends BaseController {
  /** GET /api/admin/feedbacks */
  async list() {
    const q = this.ctx.query as any;
    const result = await this.service.feedback.list({
      page: q.page ? Number(q.page) : undefined,
      pageSize: q.pageSize ? Number(q.pageSize) : undefined,
      type: q.type,
      status: q.status !== undefined ? Number(q.status) as 0 | 1 | 2 | 3 : undefined,
      platform: q.platform,
      userId: q.userId ? Number(q.userId) : undefined,
      keyword: q.keyword,
      startTime: q.startTime,
      endTime: q.endTime,
    });
    this.success(result);
  }

  /** GET /api/admin/feedbacks/:id */
  async detail() {
    const id = Number(this.ctx.params.id);
    const data = await this.service.feedback.detail(id);
    if (!data) this.ctx.throw(404, 'feedback not found');
    this.success(data);
  }

  /** POST /api/admin/feedbacks/:id/reply */
  async reply() {
    const id = Number(this.ctx.params.id);
    this.validate({
      replyContent: { type: 'string', min: 1, max: 2000 },
      snippetId: { type: 'number', required: false },
    });
    const { replyContent, snippetId } = this.ctx.request.body as any;
    const replyUserId = (this.ctx.state as any).user.id;

    let beforeData: any = null;
    try { beforeData = await this.service.feedback.detail(id); } catch { /* ignore */ }

    try {
      const updated = await this.service.feedback.reply(id, replyContent, replyUserId, snippetId);
      await this.service.audit.log({
        module: 'feedback', action: 'reply',
        bizType: 'feedback', bizId: id,
        beforeData, afterData: updated,
        description: `回复反馈 #${id}${snippetId ? `（使用话术 #${snippetId}）` : ''}`,
        status: 1,
      });
      this.success(updated, '回复成功');
    } catch (e: any) {
      await this.service.audit.log({
        module: 'feedback', action: 'reply',
        bizType: 'feedback', bizId: id,
        beforeData,
        description: `尝试回复反馈 #${id}`,
        status: 0, failReason: e.message,
      });
      throw e;
    }
  }

  /** PUT /api/admin/feedbacks/:id — 状态变更 */
  async update() {
    const id = Number(this.ctx.params.id);
    let beforeData: any = null;
    try { beforeData = await this.service.feedback.detail(id); } catch { /* ignore */ }

    try {
      const updated = await this.service.feedback.update(id, this.ctx.request.body as any);
      await this.service.audit.log({
        module: 'feedback', action: 'update',
        bizType: 'feedback', bizId: id,
        beforeData, afterData: updated,
        description: `更新反馈 #${id} 状态`,
        status: 1,
      });
      this.success(updated, '更新成功');
    } catch (e: any) {
      await this.service.audit.log({
        module: 'feedback', action: 'update',
        bizType: 'feedback', bizId: id,
        beforeData,
        description: `尝试更新反馈 #${id} 状态`,
        status: 0, failReason: e.message,
      });
      throw e;
    }
  }

  /** DELETE /api/admin/feedbacks/:id — 软删 */
  async destroy() {
    const id = Number(this.ctx.params.id);
    let beforeData: any = null;
    try { beforeData = await this.service.feedback.detail(id); } catch { /* ignore */ }

    try {
      await this.service.feedback.destroy(id);
      await this.service.audit.log({
        module: 'feedback', action: 'delete',
        bizType: 'feedback', bizId: id,
        beforeData,
        description: `删除反馈 #${id}`,
        status: 1,
      });
      this.success(null, '删除成功');
    } catch (e: any) {
      await this.service.audit.log({
        module: 'feedback', action: 'delete',
        bizType: 'feedback', bizId: id,
        beforeData,
        description: `尝试删除反馈 #${id}`,
        status: 0, failReason: e.message,
      });
      throw e;
    }
  }

  /** GET /api/admin/feedbacks/stats/overview — 统计概览 */
  async statsOverview() {
    const data = await this.service.feedback.statsOverview();
    this.success(data);
  }

  /** GET /api/admin/feedbacks/stats/trend — 趋势数据 */
  async statsTrend() {
    const days = this.ctx.query.days ? Number(this.ctx.query.days) : 30;
    const data = await this.service.feedback.statsTrend(days);
    this.success(data);
  }

  /** GET /api/admin/feedbacks/pending-count — 待处理反馈计数（badge 用） */
  async pendingCount() {
    const data = await this.service.feedback.pendingCount();
    this.success(data);
  }
}
