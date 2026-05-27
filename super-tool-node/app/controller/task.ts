import BaseController from './base';

/**
 * 任务中心控制器（C 端）
 *  设计依据: docs/superpowers/plans/2026-05-26-积分成长体系MVP实施计划-v2.md §Task 15
 *
 *  路由：
 *    GET  /api/tasks?category=newbie/daily/achievement/...  任务列表（含进度）
 *    POST /api/tasks/:code/claim                              领奖（带 Idempotency-Key + rateLimit）
 */
export default class TaskController extends BaseController {
  /** GET /api/tasks?category=... */
  async index() {
    const { ctx } = this;
    const userId = (ctx.state.user as any).id;
    const tasks = await (ctx.service as any).task.listUserTasks(userId, {
      category: ctx.query.category as string,
    });
    this.success(tasks);
  }

  /** POST /api/tasks/:code/claim */
  async claim() {
    const { ctx } = this;
    const userId = (ctx.state.user as any).id;
    const code = ctx.params.code;
    if (!code) ctx.throw(400, '任务编码必填');
    const result = await (ctx.service as any).task.claim(userId, code);
    this.success(result);
  }
}
