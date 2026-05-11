import BaseController from '../base';

export default class PermissionController extends BaseController {

  /** GET /api/admin/permissions/tree */
  async tree() {
    const { platform } = this.ctx.query;
    const result = await this.service.permission.getTree(platform as string);
    this.success(result);
  }

  /** GET /api/admin/permissions/modules — 按模块分组的权限树（用于角色权限分配 UI） */
  async modules() {
    const { platform } = this.ctx.query;
    const result = await this.service.permission.getTreeByModule(platform as string);
    this.success(result);
  }

  /** GET /api/admin/permissions/:id */
  async show() {
    const perm = await this.service.permission.findById(Number(this.ctx.params.id));
    this.success(perm);
  }

  /** POST /api/admin/permissions */
  async create() {
    this.validate({ name: { type: 'string' }, code: { type: 'string' } });
    const perm = await this.service.permission.create(this.ctx.request.body);
    this.created(perm);
  }

  /** PUT /api/admin/permissions/:id */
  async update() {
    const perm = await this.service.permission.update(Number(this.ctx.params.id), this.ctx.request.body);
    this.success(perm, '更新成功');
  }

  /** DELETE /api/admin/permissions/:id */
  async destroy() {
    await this.service.permission.delete(Number(this.ctx.params.id));
    this.success(null, '删除成功');
  }

  // ============================================================
  // Spec-A1: 权限测试综合工具（GET /api/admin/permissions/test）
  // ============================================================

  /**
   * GET /api/admin/permissions/test
   * 综合权限调试工具，3 mode：
   *   - mode=user-overview&userId=<id>
   *   - mode=user-check&userId=<id>&code=<code>
   *   - mode=user-check&userId=<id>&path=<path>&method=<METHOD>
   *   - mode=role-check&roleCode=<code> | &roleId=<id>
   */
  async test() {
    const { mode } = this.ctx.query as any;
    switch (mode) {
      case 'user-overview':
        return this._handleUserOverview();
      case 'user-check':
        return this._handleUserCheck();
      case 'role-check':
        return this._handleRoleCheck();
      default:
        this.ctx.throw(422, `unknown mode: ${mode}`);
    }
  }

  private async _handleUserOverview() {
    const userId = Number(this.ctx.query.userId);
    if (!userId) this.ctx.throw(422, 'userId required');
    const data = await this.service.permission.testForUser(userId);
    this.success(data);
  }

  private async _handleUserCheck() {
    const q = this.ctx.query as any;
    const userId = Number(q.userId);
    if (!userId) this.ctx.throw(422, 'userId required');
    const target: { code?: string; path?: string; method?: string } = {};
    if (q.code) {
      target.code = String(q.code);
    } else if (q.path && q.method) {
      target.path = String(q.path);
      target.method = String(q.method).toUpperCase();
    } else {
      this.ctx.throw(422, 'either code or (path+method) required');
    }
    const data = await this.service.permission.checkUserAccess(userId, target);
    this.success(data);
  }

  private async _handleRoleCheck() {
    const q = this.ctx.query as any;
    if (!q.roleCode && !q.roleId) {
      this.ctx.throw(422, 'roleCode or roleId required');
    }
    const data = await this.service.permission.testForRole({
      roleCode: q.roleCode ? String(q.roleCode) : undefined,
      roleId: q.roleId ? Number(q.roleId) : undefined,
    });
    this.success(data);
  }
}
