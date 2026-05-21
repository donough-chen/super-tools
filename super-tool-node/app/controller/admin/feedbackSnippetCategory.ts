import BaseController from '../base';

export default class AdminFeedbackSnippetCategoryController extends BaseController {
  /** GET /api/admin/feedback/snippet-categories */
  async tree() {
    const onlyActive = this.ctx.query.onlyActive === '1';
    const data = await this.service.feedbackSnippetCategory.tree(onlyActive);
    this.success(data);
  }

  /** GET /api/admin/feedback/snippet-categories/:id */
  async detail() {
    const id = Number(this.ctx.params.id);
    const data = await this.service.feedbackSnippetCategory.detail(id);
    this.success(data);
  }

  /** POST /api/admin/feedback/snippet-categories */
  async create() {
    this.validate({
      code: { type: 'string', min: 2, max: 64 },
      name: { type: 'string', min: 1, max: 50 },
      parentId: { type: 'number', required: false, allowEmpty: true },
      description: { type: 'string', required: false, max: 255 },
      feedbackType: { type: 'enum', values: ['bug', 'suggestion', 'praise', 'other'], required: false },
      icon: { type: 'string', required: false, max: 64 },
      color: { type: 'string', required: false, max: 16 },
      sortOrder: { type: 'number', required: false },
      status: { type: 'number', required: false },
    });

    const operatorId = (this.ctx.state as any).user?.id;
    const data = await this.service.feedbackSnippetCategory.create(
      this.ctx.request.body as any,
      operatorId,
    );

    await this.service.audit.log({
      module: 'feedback-snippet', action: 'create-category',
      bizType: 'feedback_snippet_category', bizId: (data as any).id,
      afterData: data,
      description: `创建话术分类 ${(data as any).code}`,
      status: 1,
    });

    this.created(data);
  }

  /** PUT /api/admin/feedback/snippet-categories/:id */
  async update() {
    const id = Number(this.ctx.params.id);
    const operatorId = (this.ctx.state as any).user?.id;

    let beforeData: any = null;
    try { beforeData = await this.service.feedbackSnippetCategory.detail(id); } catch { /* noop */ }

    const data = await this.service.feedbackSnippetCategory.update(
      id,
      this.ctx.request.body as any,
      operatorId,
    );

    await this.service.audit.log({
      module: 'feedback-snippet', action: 'update-category',
      bizType: 'feedback_snippet_category', bizId: id,
      beforeData, afterData: data,
      description: `更新话术分类 #${id}`,
      status: 1,
    });

    this.success(data);
  }

  /** DELETE /api/admin/feedback/snippet-categories/:id */
  async destroy() {
    const id = Number(this.ctx.params.id);
    let beforeData: any = null;
    try { beforeData = await this.service.feedbackSnippetCategory.detail(id); } catch { /* noop */ }

    await this.service.feedbackSnippetCategory.destroy(id);

    await this.service.audit.log({
      module: 'feedback-snippet', action: 'delete-category',
      bizType: 'feedback_snippet_category', bizId: id,
      beforeData,
      description: `删除话术分类 #${id}`,
      status: 1,
    });

    this.success(null, '删除成功');
  }

  /** PUT /api/admin/feedback/snippet-categories/:id/role-permissions */
  async setRolePermissions() {
    const id = Number(this.ctx.params.id);
    this.validate({
      roleIds: { type: 'array', itemType: 'number', required: true },
    });
    const { roleIds } = this.ctx.request.body as { roleIds: number[] };

    const data = await this.service.feedbackSnippetCategory.setRolePermissions(id, roleIds);

    await this.service.audit.log({
      module: 'feedback-snippet', action: 'set-category-role-perm',
      bizType: 'feedback_snippet_category', bizId: id,
      afterData: { roleIds },
      description: `设置分类 #${id} 角色访问权限`,
      status: 1,
    });

    this.success(data);
  }

  /** GET /api/admin/feedback/snippet-categories/:id/role-permissions */
  async getRolePermissions() {
    const id = Number(this.ctx.params.id);
    const roleIds = await this.service.feedbackSnippetCategory.getRolePermissions(id);
    this.success({ categoryId: id, roleIds });
  }
}
