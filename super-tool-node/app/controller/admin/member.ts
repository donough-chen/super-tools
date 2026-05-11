import BaseController from '../base';

/**
 * 管理端会员 Controller
 * 路由前缀: /api/admin/member
 */
export default class AdminMemberController extends BaseController {

  /** GET /api/admin/member/levels — 获取等级定义列表 */
  async levels() {
    const data = await this.service.member.getLevelList();
    this.success(data);
  }

  /** PUT /api/admin/member/levels/:id — 更新等级定义 */
  async updateLevel() {
    const id = Number(this.ctx.params.id);
    let beforeData: any = null;
    try {
      const list = await this.service.member.getLevelList();
      beforeData = (list as any[])?.find((l: any) => l.id === id) || null;
    } catch { /* ignore */ }

    try {
      const data = await this.service.member.updateLevel(id, this.ctx.request.body);
      await this.service.audit.log({
        module: 'member', action: 'update_level',
        bizType: 'member_level', bizId: id,
        beforeData, afterData: data,
        description: `更新会员等级 #${id}`,
        status: 1,
      });
      this.success(data, '更新成功');
    } catch (e: any) {
      await this.service.audit.log({
        module: 'member', action: 'update_level',
        bizType: 'member_level', bizId: id,
        beforeData,
        description: `尝试更新会员等级 #${id}`,
        status: 0, failReason: e.message,
      });
      throw e;
    }
  }

  /** GET /api/admin/member/plans — 获取套餐列表 */
  async plans() {
    const data = await this.service.member.getPlanList();
    this.success(data);
  }

  /** PUT /api/admin/member/plans/:id — 更新套餐 */
  async updatePlan() {
    const id = Number(this.ctx.params.id);
    let beforeData: any = null;
    try {
      const list = await this.service.member.getPlanList();
      beforeData = (list as any[])?.find((p: any) => p.id === id) || null;
    } catch { /* ignore */ }

    try {
      const data = await this.service.member.updatePlan(id, this.ctx.request.body);
      await this.service.audit.log({
        module: 'member', action: 'update_plan',
        bizType: 'member_plan', bizId: id,
        beforeData, afterData: data,
        description: `更新付费套餐 #${id}`,
        status: 1,
      });
      this.success(data, '更新成功');
    } catch (e: any) {
      await this.service.audit.log({
        module: 'member', action: 'update_plan',
        bizType: 'member_plan', bizId: id,
        beforeData,
        description: `尝试更新付费套餐 #${id}`,
        status: 0, failReason: e.message,
      });
      throw e;
    }
  }

  /** GET /api/admin/member/users — 会员用户列表 */
  async users() {
    const pagination = this.getPagination();
    const { levelCode, isPaid, keyword } = this.ctx.query;
    const result = await this.service.member.getMemberUsers({
      ...pagination, levelCode, isPaid, keyword,
    });
    this.paginated(result);
  }

  /** GET /api/admin/member/users/:id — 单个用户会员详情 */
  async userDetail() {
    const data = await this.service.member.getMemberInfo(Number(this.ctx.params.id));
    this.success(data);
  }

  /** POST /api/admin/member/users/:id/adjust-points — 手动调整积分 */
  async adjustPoints() {
    this.validate({
      points: { type: 'number', required: true },
      remark: { type: 'string', required: true },
    });
    const userId = Number(this.ctx.params.id);
    const { points, growthDelta = 0, remark } = this.ctx.request.body;
    let before: any = null;
    try { before = await this.service.member.getMemberInfo(userId); } catch { /* ignore */ }

    try {
      const data = await this.service.member.adjustPoints(userId, points, growthDelta, remark);
      await this.service.audit.log({
        module: 'member', action: 'adjust_points',
        bizType: 'member', bizId: userId,
        beforeData: before,
        afterData: { points, growthDelta, remark, after: data },
        description: `调整用户 #${userId} 积分 ${points > 0 ? '+' : ''}${points}（${remark || '无原因'}）`,
        status: 1,
      });
      this.success(data, '调整成功');
    } catch (e: any) {
      await this.service.audit.log({
        module: 'member', action: 'adjust_points',
        bizType: 'member', bizId: userId,
        beforeData: before,
        description: `尝试调整用户 #${userId} 积分 ${points}`,
        status: 0, failReason: e.message,
      });
      throw e;
    }
  }

  /** PUT /api/admin/member/users/:id/level — 手动调整等级 */
  async adjustLevel() {
    this.validate({ levelId: { type: 'number', required: true } });
    const userId = Number(this.ctx.params.id);
    const { levelId } = this.ctx.request.body;
    let before: any = null;
    try { before = await this.service.member.getMemberInfo(userId); } catch { /* ignore */ }

    try {
      const data = await this.service.member.adjustLevel(userId, levelId);
      await this.service.audit.log({
        module: 'member', action: 'adjust_level',
        bizType: 'member', bizId: userId,
        beforeData: before, afterData: { levelId, after: data },
        description: `调整用户 #${userId} 等级到 levelId=${levelId}`,
        status: 1,
      });
      this.success(data, '等级调整成功');
    } catch (e: any) {
      await this.service.audit.log({
        module: 'member', action: 'adjust_level',
        bizType: 'member', bizId: userId,
        beforeData: before,
        description: `尝试调整用户 #${userId} 等级`,
        status: 0, failReason: e.message,
      });
      throw e;
    }
  }

  /** POST /api/admin/member/users/:id/activate-plan — 手动开通付费会员 */
  async activatePlan() {
    this.validate({ planCode: { type: 'string', required: true } });
    const userId = Number(this.ctx.params.id);
    const { planCode } = this.ctx.request.body;
    let before: any = null;
    try { before = await this.service.member.getMemberInfo(userId); } catch { /* ignore */ }

    try {
      const data = await this.service.member.activatePaidPlan(userId, planCode);
      await this.service.audit.log({
        module: 'member', action: 'activate_plan',
        bizType: 'member', bizId: userId,
        beforeData: before, afterData: { planCode, after: data },
        description: `为用户 #${userId} 开通套餐 ${planCode}`,
        status: 1,
      });
      this.success(data, '开通成功');
    } catch (e: any) {
      await this.service.audit.log({
        module: 'member', action: 'activate_plan',
        bizType: 'member', bizId: userId,
        beforeData: before,
        description: `尝试为用户 #${userId} 开通套餐 ${planCode}`,
        status: 0, failReason: e.message,
      });
      throw e;
    }
  }

  /** GET /api/admin/member/stats — 会员统计数据 */
  async stats() {
    const data = await this.service.member.getMemberStats();
    this.success(data);
  }

  /** GET /api/admin/member/points-logs — 全局积分流水查询 */
  async pointsLogs() {
    const pagination = this.getPagination();
    const { userId, type, source, startDate, endDate } = this.ctx.query;
    const result = await this.service.member.getAdminPointsLogs({
      ...pagination, userId, type, source, startDate, endDate,
    });
    this.paginated(result);
  }
}
