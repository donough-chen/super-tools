import BaseController from '../base';

export default class PermissionController extends BaseController {

  /** GET /api/admin/permissions/tree */
  async tree() {
    const { platform } = this.ctx.query;
    const result = await this.service.permission.getTree(platform as string);
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
}
