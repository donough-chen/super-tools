import BaseController from '../base';

/**
 * 积分运维控制器（管理端）
 *  设计依据: docs/superpowers/plans/2026-05-26-积分成长体系MVP实施计划-v2.md §Task 16
 *           docs/superpowers/plans/2026-05-27-积分成长体系后端优化-A基础设施实施计划.md Task A8
 *
 *  路由（注册见 router.ts）：
 *    GET  /api/admin/points/expire/stats           过期统计
 *    GET  /api/admin/points/reconcile?date&onlyAnomaly  对账快照查询
 *    POST /api/admin/points/ops/trigger            手工触发定时任务（开发期联调）
 *    POST /api/admin/points/cache/clear?levelId    清空 pointsRule 等级规则缓存（A8 新增）
 */
export default class AdminPointsOpsController extends BaseController {
  /** GET /api/admin/points/expire/stats */
  async expireStats() {
    const r = await (this.ctx.service as any).pointsExpire.getStats();
    this.success(r);
  }

  /** GET /api/admin/points/reconcile */
  async reconcile() {
    const { ctx } = this;
    const r: any = await (ctx.service as any).pointsReconcile.listSnapshots({
      date: ctx.query.date as string | undefined,
      onlyAnomaly: ctx.query.onlyAnomaly === 'true' || ctx.query.onlyAnomaly === '1',
      page: Number(ctx.query.page) || 1,
      pageSize: Math.min(Number(ctx.query.pageSize) || 50, 200),
    });
    this.success({ list: r.rows, total: r.count });
  }

  /** POST /api/admin/points/ops/trigger  body: { task: 'expire'|'remind'|'snapshot'|'check' } */
  async trigger() {
    const { ctx } = this;
    const task = (ctx.request.body as any)?.task;
    let r: any;
    switch (task) {
      case 'expire':
        r = await (ctx.service as any).pointsExpire.processExpiredBatches();
        break;
      case 'remind':
        r = await (ctx.service as any).pointsExpire.sendExpireReminders();
        break;
      case 'snapshot':
        r = await (ctx.service as any).pointsReconcile.takeDailySnapshot();
        break;
      case 'check':
        r = await (ctx.service as any).pointsReconcile.hourlyBalanceCheck();
        break;
      default:
        ctx.throw(400, 'task 必须是 expire/remind/snapshot/check 之一');
    }
    this.success({ task, result: r });
  }

  /**
   * POST /api/admin/points/cache/clear?levelId=X
   *  清空 pointsRule 的等级规则缓存（用于运维在改完 member_levels.benefits 后立即生效）
   *   - 不传 levelId：清空全部等级缓存（key 模式 `points:rule:*`）
   *   - 传 levelId：仅清该等级的缓存
   *   - 同时支持 query / body 两种传参方式
   *
   *  设计依据: docs/superpowers/plans/2026-05-27-积分成长体系后端优化-A基础设施实施计划.md Task A8
   *           docs/superpowers/specs/2026-05-27-积分成长体系后端优化设计文档.md §2.5-#17
   */
  async clearRuleCache() {
    const { ctx } = this;
    const levelIdRaw =
      (ctx.query.levelId as string | undefined) ||
      ((ctx.request.body as any)?.levelId as string | number | undefined);
    let levelId: number | undefined;
    if (levelIdRaw !== undefined && levelIdRaw !== null && levelIdRaw !== '') {
      const n = Number(levelIdRaw);
      if (Number.isNaN(n) || n <= 0) ctx.throw(400, 'levelId 必须是正整数');
      levelId = n;
    }
    await (this.ctx.service as any).pointsRule.invalidateCache(levelId);
    this.success({
      cleared: true,
      levelId: levelId === undefined ? 'all' : levelId,
      timestamp: Date.now(),
    });
  }
}
