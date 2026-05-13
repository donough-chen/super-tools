import BaseController from '../base';

export default class RoleController extends BaseController {

  /** GET /api/admin/roles */
  async index() {
    const pagination = this.getPagination();
    const { keyword, status, platform } = this.ctx.query;
    const result = await this.service.role.findList({
      ...pagination, keyword, status: status !== undefined ? Number(status) : undefined, platform,
    });
    this.paginated(result);
  }

  /** GET /api/admin/roles/:id */
  async show() {
    const role = await this.service.role.findById(Number(this.ctx.params.id));
    this.success(role);
  }

  /** POST /api/admin/roles */
  async create() {
    this.validate({ name: { type: 'string' }, code: { type: 'string' } });
    const body = this.ctx.request.body;
    try {
      const role = await this.service.role.create(body);
      await this.service.audit.log({
        module: 'role', action: 'create',
        bizType: 'role', bizId: (role as any)?.id,
        afterData: role,
        description: `创建角色 ${body?.code || ''}`,
        status: 1,
      });
      this.created(role);
    } catch (e: any) {
      await this.service.audit.log({
        module: 'role', action: 'create',
        description: `尝试创建角色 ${body?.code || '(未知)'}`,
        status: 0, failReason: e.message,
      });
      throw e;
    }
  }

  /** PUT /api/admin/roles/:id */
  async update() {
    const id = Number(this.ctx.params.id);
    let beforeData: any = null;
    try { beforeData = await this.service.role.findById(id); } catch { /* ignore */ }

    try {
      const role = await this.service.role.update(id, this.ctx.request.body);
      await this.service.audit.log({
        module: 'role', action: 'update', bizType: 'role', bizId: id,
        beforeData, afterData: role,
        description: `更新角色 #${id}`, status: 1,
      });
      this.success(role, '更新成功');
    } catch (e: any) {
      await this.service.audit.log({
        module: 'role', action: 'update', bizType: 'role', bizId: id,
        beforeData,
        description: `尝试更新角色 #${id}`,
        status: 0, failReason: e.message,
      });
      throw e;
    }
  }

  /** DELETE /api/admin/roles/:id */
  async destroy() {
    const id = Number(this.ctx.params.id);
    let beforeData: any = null;
    try { beforeData = await this.service.role.findById(id); } catch { /* ignore */ }

    try {
      await this.service.role.delete(id);
      await this.service.audit.log({
        module: 'role', action: 'delete', bizType: 'role', bizId: id,
        beforeData,
        description: `删除角色 #${id}`,
        status: 1,
      });
      this.success(null, '删除成功');
    } catch (e: any) {
      await this.service.audit.log({
        module: 'role', action: 'delete', bizType: 'role', bizId: id,
        beforeData,
        description: `尝试删除角色 #${id}`,
        status: 0, failReason: e.message,
      });
      throw e;
    }
  }

  /** PUT /api/admin/roles/:id/permissions */
  async assignPermissions() {
    this.validate({ permissionIds: { type: 'array', itemType: 'number' } });
    const id = Number(this.ctx.params.id);
    const permissionIds: number[] = this.ctx.request.body.permissionIds;
    let beforeData: any = null;
    try { beforeData = await this.service.role.findById(id); } catch { /* ignore */ }

    try {
      await this.service.role.assignPermissions(id, permissionIds);
      await this.service.audit.log({
        module: 'role', action: 'assign_permissions',
        bizType: 'role', bizId: id,
        beforeData,
        afterData: { permissionIds },
        description: `为角色 #${id} 分配 ${permissionIds.length} 个权限`,
        status: 1,
      });
      this.success(null, '权限分配成功');
    } catch (e: any) {
      await this.service.audit.log({
        module: 'role', action: 'assign_permissions',
        bizType: 'role', bizId: id,
        beforeData,
        description: `尝试为角色 #${id} 分配权限`,
        status: 0, failReason: e.message,
      });
      throw e;
    }
  }

  /** GET /api/admin/roles/:id/users — 获取角色绑定的用户列表 */
  async users() {
    const roleId = Number(this.ctx.params.id);
    const pagination = this.getPagination();
    const { keyword } = this.ctx.query;
    const result = await this.service.role.getRoleUsers(roleId, { ...pagination, keyword });
    this.paginated(result);
  }

  /** PUT /api/admin/roles/:id/users — 为角色批量添加用户 */
  async assignUsers() {
    this.validate({ userIds: { type: 'array', itemType: 'number' } });
    const roleId = Number(this.ctx.params.id);
    const { userIds } = this.ctx.request.body;
    const grantedBy = this.ctx.state.user.id;

    try {
      await this.service.role.assignUsers(roleId, userIds, grantedBy);
      await this.service.audit.log({
        module: 'role', action: 'assign_users',
        bizType: 'role', bizId: roleId,
        afterData: { userIds },
        description: `为角色 #${roleId} 添加 ${userIds.length} 个用户`,
        status: 1,
      });
      this.success(null, '用户添加成功');
    } catch (e: any) {
      await this.service.audit.log({
        module: 'role', action: 'assign_users',
        bizType: 'role', bizId: roleId,
        description: `尝试为角色 #${roleId} 添加用户`,
        status: 0, failReason: e.message,
      });
      throw e;
    }
  }

  /** DELETE /api/admin/roles/:id/users/:userId — 从角色移除用户 */
  async removeUser() {
    const roleId = Number(this.ctx.params.id);
    const userId = Number(this.ctx.params.userId);

    try {
      await this.service.role.removeUser(roleId, userId);
      await this.service.audit.log({
        module: 'role', action: 'remove_user',
        bizType: 'role', bizId: roleId,
        afterData: { removedUserId: userId },
        description: `从角色 #${roleId} 移除用户 #${userId}`,
        status: 1,
      });
      this.success(null, '用户已移除');
    } catch (e: any) {
      await this.service.audit.log({
        module: 'role', action: 'remove_user',
        bizType: 'role', bizId: roleId,
        description: `尝试从角色 #${roleId} 移除用户 #${userId}`,
        status: 0, failReason: e.message,
      });
      throw e;
    }
  }
}
