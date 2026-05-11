import BaseController from '../base';

/**
 * 管理端用户自查 Controller
 * 路由前缀: /api/admin/auth
 * 仅挂 auth 中间件（用户自查，无需 perm）
 */
export default class AdminAuthController extends BaseController {

  /** GET /api/admin/auth/menus */
  async menus() {
    const userId = this.ctx.state.user.id;
    const data = await this.service.permission.getMenusForUser(userId, 'admin');
    this.success(data);
  }

  /** GET /api/admin/auth/permissions */
  async permissions() {
    const userId = this.ctx.state.user.id;
    const data = await this.service.permission.getUserPermissionCodes(userId);
    this.success(data);
  }
}
