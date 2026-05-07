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
}
