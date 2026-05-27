import BaseController from './base';

/**
 * 签到控制器（C 端）
 *  设计依据: docs/superpowers/plans/2026-05-26-积分成长体系MVP实施计划-v2.md §Task 15
 *
 *  路由：
 *    POST /api/sign                          每日签到（带 Idempotency-Key + rateLimit）
 *    GET  /api/sign/status?yearMonth=2026-05  当月签到状态/日历
 */
export default class SignController extends BaseController {
  /** POST /api/sign */
  async create() {
    const { ctx } = this;
    const userId = (ctx.state.user as any).id;
    const result = await (ctx.service as any).sign.dailySign(userId);
    this.success(result);
  }

  /** GET /api/sign/status?yearMonth=YYYY-MM */
  async status() {
    const { ctx } = this;
    const userId = (ctx.state.user as any).id;
    const ym = ctx.query.yearMonth as string | undefined;
    const result = await (ctx.service as any).sign.getSignStatus(userId, ym);
    this.success(result);
  }
}
