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
    const data = await this.service.member.updateLevel(
      Number(this.ctx.params.id),
      this.ctx.request.body,
    );
    this.success(data, '更新成功');
  }

  /** GET /api/admin/member/plans — 获取套餐列表 */
  async plans() {
    const data = await this.service.member.getPlanList();
    this.success(data);
  }

  /** PUT /api/admin/member/plans/:id — 更新套餐 */
  async updatePlan() {
    const data = await this.service.member.updatePlan(
      Number(this.ctx.params.id),
      this.ctx.request.body,
    );
    this.success(data, '更新成功');
  }

  /** GET /api/admin/member/users — 会员用户列表 */
  async users() {
    const pagination = this.getPagination();
    const { levelCode, isPaid, keyword } = this.ctx.query;
    const result = await this.service.member.getMemberUsers({
      ...pagination,
      levelCode,
      isPaid,
      keyword,
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
    const { points, growthDelta = 0, remark } = this.ctx.request.body;
    const data = await this.service.member.adjustPoints(
      Number(this.ctx.params.id),
      points,
      growthDelta,
      remark,
    );
    this.success(data, '调整成功');
  }

  /** PUT /api/admin/member/users/:id/level — 手动调整等级 */
  async adjustLevel() {
    this.validate({ levelId: { type: 'number', required: true } });
    const data = await this.service.member.adjustLevel(
      Number(this.ctx.params.id),
      this.ctx.request.body.levelId,
    );
    this.success(data, '等级调整成功');
  }

  /** POST /api/admin/member/users/:id/activate-plan — 手动开通付费会员 */
  async activatePlan() {
    this.validate({ planCode: { type: 'string', required: true } });
    const data = await this.service.member.activatePaidPlan(
      Number(this.ctx.params.id),
      this.ctx.request.body.planCode,
    );
    this.success(data, '开通成功');
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
      ...pagination,
      userId,
      type,
      source,
      startDate,
      endDate,
    });
    this.paginated(result);
  }
}
