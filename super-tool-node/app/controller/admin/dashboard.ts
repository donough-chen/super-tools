import BaseController from '../base';

export default class DashboardController extends BaseController {

  /** GET /api/admin/dashboard */
  async index() {
    const { Op } = require('sequelize');
    const userCount = await this.ctx.model.User.count();
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
    const todayLoginCount = await this.ctx.model.LoginLog.count({
      where: { status: 1, created_at: { [Op.gte]: todayStart } },
    });
    const activeSessionCount = await this.ctx.model.UserSession.count({ where: { isActive: 1 } });
    const roleCount = await this.ctx.model.Role.count();

    this.success({ userCount, todayLoginCount, activeSessionCount, roleCount }, '获取成功');
  }

  /** GET /api/admin/dashboard/system-status */
  async systemStatus() {
    const data = await this.service.dashboard.getSystemStatus();
    this.success(data);
  }

  // ==================== Phase 5: 移动端适配 ====================

  /** GET /api/admin/dashboard/mobile-summary */
  async mobileSummary() {
    const data = await this.service.dashboard.getMobileSummary();
    this.success(data);
  }

  /** GET /api/admin/dashboard/push-settings */
  async getPushSettings() {
    const userId = (this.ctx.state.user as any)?.id;
    const data = await this.service.dashboard.getPushSettings(userId);
    this.success(data);
  }

  /** POST /api/admin/dashboard/push-settings */
  async savePushSettings() {
    const userId = (this.ctx.state.user as any)?.id;
    const data = await this.service.dashboard.savePushSettings(userId, this.ctx.request.body);
    this.success(data);
  }
}
