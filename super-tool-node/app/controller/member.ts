import BaseController from './base';

/**
 * C 端会员 Controller
 * 路由前缀: /api/member
 */
export default class MemberController extends BaseController {

  /** GET /api/member/info — 获取当前用户会员信息 */
  async info() {
    const userId = (this.ctx.state.user as any).id;
    const data = await this.service.member.getMemberInfo(userId);
    this.success(data);
  }

  /** GET /api/member/benefits — 获取当前用户聚合权益 */
  async benefits() {
    const userId = (this.ctx.state.user as any).id;
    const data = await this.service.member.getMergedBenefits(userId);
    this.success(data);
  }

  /** GET /api/member/levels — 获取全部成长等级列表（公开） */
  async levels() {
    const data = await this.service.member.getLevelList();
    this.success(data);
  }

  /** GET /api/member/plans — 获取付费套餐列表（公开） */
  async plans() {
    const data = await this.service.member.getPlanList();
    this.success(data);
  }

  /** GET /api/member/points-logs — 获取积分流水（分页） */
  async pointsLogs() {
    const userId = (this.ctx.state.user as any).id;
    const pagination = this.getPagination();
    const { type, startDate, endDate } = this.ctx.query;
    const result = await this.service.member.getPointsLogs(userId, {
      ...pagination,
      type,
      startDate,
      endDate,
    });
    this.paginated(result);
  }

  /** POST /api/member/daily-sign — 每日签到 */
  async dailySign() {
    const userId = (this.ctx.state.user as any).id;
    const data = await this.service.member.dailySign(userId);
    this.success(data, '签到成功');
  }
}
