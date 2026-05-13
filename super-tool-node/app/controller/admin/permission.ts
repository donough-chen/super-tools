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
    const body = this.ctx.request.body;
    try {
      const perm = await this.service.permission.create(body);
      await this.service.audit.log({
        module: 'permission', action: 'create',
        bizType: 'permission', bizId: (perm as any)?.id,
        afterData: perm,
        description: `创建权限码 ${body?.code || ''}`,
        status: 1,
      });
      this.created(perm);
    } catch (e: any) {
      await this.service.audit.log({
        module: 'permission', action: 'create',
        description: `尝试创建权限码 ${body?.code || '(未知)'}`,
        status: 0, failReason: e.message,
      });
      throw e;
    }
  }

  /** PUT /api/admin/permissions/:id */
  async update() {
    const id = Number(this.ctx.params.id);
    let beforeData: any = null;
    try { beforeData = await this.service.permission.findById(id); } catch { /* ignore */ }

    try {
      const perm = await this.service.permission.update(id, this.ctx.request.body);
      await this.service.audit.log({
        module: 'permission', action: 'update',
        bizType: 'permission', bizId: id,
        beforeData, afterData: perm,
        description: `更新权限码 #${id}`,
        status: 1,
      });
      this.success(perm, '更新成功');
    } catch (e: any) {
      await this.service.audit.log({
        module: 'permission', action: 'update',
        bizType: 'permission', bizId: id,
        beforeData,
        description: `尝试更新权限码 #${id}`,
        status: 0, failReason: e.message,
      });
      throw e;
    }
  }

  /** DELETE /api/admin/permissions/:id */
  async destroy() {
    const id = Number(this.ctx.params.id);
    let beforeData: any = null;
    try { beforeData = await this.service.permission.findById(id); } catch { /* ignore */ }

    try {
      await this.service.permission.delete(id);
      await this.service.audit.log({
        module: 'permission', action: 'delete',
        bizType: 'permission', bizId: id,
        beforeData,
        description: `删除权限码 #${id}`,
        status: 1,
      });
      this.success(null, '删除成功');
    } catch (e: any) {
      await this.service.audit.log({
        module: 'permission', action: 'delete',
        bizType: 'permission', bizId: id,
        beforeData,
        description: `尝试删除权限码 #${id}`,
        status: 0, failReason: e.message,
      });
      throw e;
    }
  }

  // ============================================================
  // 权限-角色联动（权限管理增强 v2.10）
  // ============================================================

  /** GET /api/admin/permissions/:id/holders — 查询拥有该权限的所有角色 */
  async holders() {
    const id = Number(this.ctx.params.id);
    const result = await this.service.permission.getPermissionHolders(id);
    this.success(result);
  }

  /** PUT /api/admin/permissions/:id/batch-assign — 批量将权限分配给多个角色 */
  async batchAssign() {
    const id = Number(this.ctx.params.id);
    const { roleIds = [], removeFromRoleIds = [] } = this.ctx.request.body;

    let beforeData: any = null;
    try { beforeData = await this.service.permission.getPermissionHolders(id); } catch { /* ignore */ }

    try {
      const result = await this.service.permission.batchAssignToRoles(id, roleIds, removeFromRoleIds);
      await this.service.audit.log({
        module: 'permission', action: 'batch_assign',
        bizType: 'permission', bizId: id,
        beforeData,
        afterData: { roleIds, removeFromRoleIds },
        description: `批量赋权 #${id}: 添加 ${roleIds.length} 个角色, 移除 ${removeFromRoleIds.length} 个角色`,
        status: 1,
      });
      this.success(result, '批量赋权成功');
    } catch (e: any) {
      await this.service.audit.log({
        module: 'permission', action: 'batch_assign',
        bizType: 'permission', bizId: id,
        beforeData,
        description: `尝试批量赋权 #${id}`,
        status: 0, failReason: e.message,
      });
      throw e;
    }
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
