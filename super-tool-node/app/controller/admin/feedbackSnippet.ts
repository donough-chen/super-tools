import BaseController from '../base';

export default class AdminFeedbackSnippetController extends BaseController {
  // ============================================================
  // CRUD
  // ============================================================

  /** GET /api/admin/feedback/snippets */
  async list() {
    const q = this.ctx.query as any;
    const operatorId = (this.ctx.state as any).user?.id;

    // 列表也按访问权限过滤（避免越权看到不该看的话术）
    const accessibleIds = await this.service.feedbackSnippetCategory.accessibleCategoryIds(operatorId);

    const data = await this.service.feedbackSnippet.list({
      page: q.page ? Number(q.page) : undefined,
      pageSize: q.pageSize ? Number(q.pageSize) : undefined,
      categoryId: q.categoryId ? Number(q.categoryId) : undefined,
      status: q.status !== undefined && q.status !== '' ? Number(q.status) as 0 | 1 | 2 : undefined,
      tag: q.tag,
      keyword: q.keyword,
    }, accessibleIds);
    this.paginated(data);
  }

  /** GET /api/admin/feedback/snippets/:id */
  async detail() {
    const id = Number(this.ctx.params.id);
    const data = await this.service.feedbackSnippet.detail(id);
    this.success(data);
  }

  /** POST /api/admin/feedback/snippets */
  async create() {
    this.validate({
      categoryId: { type: 'number', required: true },
      code: { type: 'string', min: 2, max: 64 },
      title: { type: 'string', min: 1, max: 100 },
      content: { type: 'string', min: 1, max: 5000 },
      tags: { type: 'string', required: false, max: 255 },
      sampleVariables: { type: 'object', required: false },
      description: { type: 'string', required: false, max: 500 },
    });

    const operatorId = (this.ctx.state as any).user?.id;
    const data = await this.service.feedbackSnippet.create(
      this.ctx.request.body as any,
      operatorId,
    );

    await this.service.audit.log({
      module: 'feedback-snippet', action: 'create',
      bizType: 'feedback_snippet', bizId: (data as any).id,
      afterData: data,
      description: `创建话术 ${(data as any).code}`,
      status: 1,
    });

    this.created(data);
  }

  /** PUT /api/admin/feedback/snippets/:id */
  async update() {
    const id = Number(this.ctx.params.id);
    const operatorId = (this.ctx.state as any).user?.id;

    let beforeData: any = null;
    try { beforeData = await this.service.feedbackSnippet.detail(id); } catch { /* noop */ }

    const data = await this.service.feedbackSnippet.update(
      id,
      this.ctx.request.body as any,
      operatorId,
    );

    await this.service.audit.log({
      module: 'feedback-snippet', action: 'update',
      bizType: 'feedback_snippet', bizId: id,
      beforeData, afterData: data,
      description: `更新话术 #${id}`,
      status: 1,
    });

    this.success(data);
  }

  /** DELETE /api/admin/feedback/snippets/:id */
  async destroy() {
    const id = Number(this.ctx.params.id);
    let beforeData: any = null;
    try { beforeData = await this.service.feedbackSnippet.detail(id); } catch { /* noop */ }

    await this.service.feedbackSnippet.destroy(id);

    await this.service.audit.log({
      module: 'feedback-snippet', action: 'delete',
      bizType: 'feedback_snippet', bizId: id,
      beforeData,
      description: `删除话术 #${id}`,
      status: 1,
    });

    this.success(null, '删除成功');
  }

  // ============================================================
  // 发布 / 停用 / 回滚
  // ============================================================

  /** POST /api/admin/feedback/snippets/:id/publish */
  async publish() {
    const id = Number(this.ctx.params.id);
    const { changeNote } = (this.ctx.request.body || {}) as any;
    const operatorId = (this.ctx.state as any).user?.id;

    const data = await this.service.feedbackSnippet.publish(id, changeNote || null, operatorId);

    await this.service.audit.log({
      module: 'feedback-snippet', action: 'publish',
      bizType: 'feedback_snippet', bizId: id,
      afterData: data,
      description: `发布话术 #${id} v${data.version}`,
      status: 1,
    });

    this.success(data);
  }

  /** POST /api/admin/feedback/snippets/:id/disable */
  async disable() {
    const id = Number(this.ctx.params.id);
    const operatorId = (this.ctx.state as any).user?.id;
    const data = await this.service.feedbackSnippet.disable(id, operatorId);

    await this.service.audit.log({
      module: 'feedback-snippet', action: 'disable',
      bizType: 'feedback_snippet', bizId: id,
      description: `停用话术 #${id}`,
      status: 1,
    });

    this.success(data);
  }

  /** POST /api/admin/feedback/snippets/:id/rollback/:versionId */
  async rollback() {
    const id = Number(this.ctx.params.id);
    const versionId = Number(this.ctx.params.versionId);
    const operatorId = (this.ctx.state as any).user?.id;

    const data = await this.service.feedbackSnippet.rollback(id, versionId, operatorId);

    await this.service.audit.log({
      module: 'feedback-snippet', action: 'rollback',
      bizType: 'feedback_snippet', bizId: id,
      afterData: data,
      description: `回滚话术 #${id} 到版本 #${versionId}（新版本号 v${data.version}）`,
      status: 1,
    });

    this.success(data);
  }

  /** GET /api/admin/feedback/snippets/:id/versions */
  async versions() {
    const id = Number(this.ctx.params.id);
    const data = await this.service.feedbackSnippet.listVersions(id);
    this.success(data);
  }

  // ============================================================
  // 使用相关
  // ============================================================

  /** GET /api/admin/feedback/snippets/picker */
  async picker() {
    const operatorId = (this.ctx.state as any).user?.id;
    const accessibleIds = await this.service.feedbackSnippetCategory.accessibleCategoryIds(operatorId);
    const data = await this.service.feedbackSnippet.picker(accessibleIds);
    this.success(data);
  }

  /** GET /api/admin/feedback/snippets/recommend?feedbackId=xx */
  async recommend() {
    const feedbackId = Number(this.ctx.query.feedbackId);
    if (!feedbackId) this.ctx.throw(422, 'feedbackId 必填');

    const operatorId = (this.ctx.state as any).user?.id;
    const accessibleIds = await this.service.feedbackSnippetCategory.accessibleCategoryIds(operatorId);
    const data = await this.service.feedbackSnippet.recommend(feedbackId, operatorId, accessibleIds);
    this.success(data);
  }

  /** POST /api/admin/feedback/snippets/:id/render */
  async render() {
    const id = Number(this.ctx.params.id);
    const body = (this.ctx.request.body || {}) as any;
    const operatorId = (this.ctx.state as any).user?.id;

    const data = await this.service.feedbackSnippet.render(id, {
      variables: body.variables,
      feedbackId: body.feedbackId,
      adminId: operatorId,
    });
    this.success(data);
  }

  /** POST /api/admin/feedback/snippets/:id/usage */
  async usage() {
    const id = Number(this.ctx.params.id);
    this.validate({
      feedbackId: { type: 'number', required: true },
      finalContent: { type: 'string', required: false, max: 5000 },
    });
    const { feedbackId, finalContent } = this.ctx.request.body as any;
    const operatorId = (this.ctx.state as any).user?.id;

    await this.service.feedbackSnippet.recordUsage(id, feedbackId, operatorId, finalContent);
    this.success(null, '已记录');
  }

  // ============================================================
  // 统计
  // ============================================================

  /** GET /api/admin/feedback/snippets/stats/overview */
  async statsOverview() {
    const data = await this.service.feedbackSnippet.statsOverview();
    this.success(data);
  }

  /** GET /api/admin/feedback/snippets/stats/top */
  async statsTop() {
    const limit = this.ctx.query.limit ? Number(this.ctx.query.limit) : 10;
    const data = await this.service.feedbackSnippet.statsTop(limit);
    this.success(data);
  }

  /** GET /api/admin/feedback/snippets/stats/trend */
  async statsTrend() {
    const days = this.ctx.query.days ? Number(this.ctx.query.days) : 30;
    const data = await this.service.feedbackSnippet.statsTrend(days);
    this.success(data);
  }

  // ============================================================
  // 导入导出
  // ============================================================

  /** GET /api/admin/feedback/snippets/export */
  async exportAll() {
    const data = await this.service.feedbackSnippet.exportAll();

    await this.service.audit.log({
      module: 'feedback-snippet', action: 'export',
      bizType: 'feedback_snippet', bizId: 0,
      description: `导出话术（${(data as any).snippets?.length || 0} 条）`,
      status: 1,
    });

    // 直接以 JSON 形式返回，前端做 Blob 下载
    this.success(data);
  }

  /** POST /api/admin/feedback/snippets/import */
  async importData() {
    const body = (this.ctx.request.body || {}) as any;
    const operatorId = (this.ctx.state as any).user?.id;

    const result = await this.service.feedbackSnippet.importData(body, operatorId);

    await this.service.audit.log({
      module: 'feedback-snippet', action: 'import',
      bizType: 'feedback_snippet', bizId: 0,
      afterData: result,
      description: `导入话术 ${result.snippetsCreated} 条 / 分类 ${result.categoriesCreated} 个`,
      status: 1,
    });

    this.success(result, '导入完成');
  }
}
