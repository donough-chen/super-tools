import BaseController from '../base';

export default class AdminLayoutController extends BaseController {

  /** GET /api/admin/dashboard/layouts */
  async list() {
    const userId = (this.ctx.state.user as any)?.id;
    const data = await this.service.layout.listLayouts(userId);
    this.success(data);
  }

  /** GET /api/admin/dashboard/layouts/:id */
  async show() {
    const id = Number(this.ctx.params.id);
    const userId = (this.ctx.state.user as any)?.id;
    const data = await this.service.layout.getLayout(id, userId);
    this.success(data);
  }

  /** POST /api/admin/dashboard/layouts */
  async create() {
    const userId = (this.ctx.state.user as any)?.id;
    const data = await this.service.layout.createLayout(userId, this.ctx.request.body);
    this.created(data);
  }

  /** PUT /api/admin/dashboard/layouts/:id */
  async update() {
    const id = Number(this.ctx.params.id);
    const userId = (this.ctx.state.user as any)?.id;
    const data = await this.service.layout.updateLayout(id, userId, this.ctx.request.body);
    this.success(data);
  }

  /** DELETE /api/admin/dashboard/layouts/:id */
  async destroy() {
    const id = Number(this.ctx.params.id);
    const userId = (this.ctx.state.user as any)?.id;
    await this.service.layout.deleteLayout(id, userId);
    this.success(null, '删除成功');
  }

  /** PUT /api/admin/dashboard/layouts/:id/default */
  async setDefault() {
    const id = Number(this.ctx.params.id);
    const userId = (this.ctx.state.user as any)?.id;
    const data = await this.service.layout.setDefault(id, userId);
    this.success(data);
  }

  /** POST /api/admin/dashboard/layouts/:id/share */
  async share() {
    const id = Number(this.ctx.params.id);
    const userId = (this.ctx.state.user as any)?.id;
    const data = await this.service.layout.toggleShare(id, userId);
    this.success(data);
  }

  /** GET /api/admin/dashboard/shared/:token (免登录) */
  async getShared() {
    const token = this.ctx.params.token;
    const data = await this.service.layout.getSharedLayout(token);
    this.success(data);
  }
}
