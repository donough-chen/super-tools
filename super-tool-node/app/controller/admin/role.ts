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
    const role = await this.service.role.create(this.ctx.request.body);
    this.created(role);
  }

  /** PUT /api/admin/roles/:id */
  async update() {
    const role = await this.service.role.update(Number(this.ctx.params.id), this.ctx.request.body);
    this.success(role, '更新成功');
  }

  /** DELETE /api/admin/roles/:id */
  async destroy() {
    await this.service.role.delete(Number(this.ctx.params.id));
    this.success(null, '删除成功');
  }

  /** PUT /api/admin/roles/:id/permissions */
  async assignPermissions() {
    this.validate({ permissionIds: { type: 'array', itemType: 'number' } });
    await this.service.role.assignPermissions(Number(this.ctx.params.id), this.ctx.request.body.permissionIds);
    this.success(null, '权限分配成功');
  }
}
