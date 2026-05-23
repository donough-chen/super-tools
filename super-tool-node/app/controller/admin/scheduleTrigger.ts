import BaseController from '../base';
import OrderExpireCheck from '../../schedule/orderExpireCheck';
import MemberExpireCheck from '../../schedule/memberExpireCheck';

/**
 * 管理端调度触发器 Controller — Phase 2
 * 路由：POST /api/admin/dev/trigger-schedule
 * 权限：system:dev:trigger-schedule（仅 admin / super_admin 持有）
 *
 * 用途：开发期 / 测试期手动触发定时任务，避免等 cron 调度（如等 5 分钟订单过期检查）。
 * 生产环境应禁用此接口（通过 RBAC 不授权 operator 即可，super_admin 默认拥有但不会用）。
 */
export default class ScheduleTriggerController extends BaseController {
  async trigger() {
    this.validate({ taskName: { type: 'string', required: true } });
    const { taskName } = this.ctx.request.body;

    const TaskClass: any =
      taskName === 'orderExpireCheck' ? OrderExpireCheck
        : taskName === 'memberExpireCheck' ? MemberExpireCheck
          : null;
    if (!TaskClass) this.ctx.throw(400, `未知 task: ${taskName}（支持: orderExpireCheck / memberExpireCheck）`);

    // egg Subscription 通常通过 schedule worker 实例化；这里手动 new 并挂 ctx
    const task: any = new TaskClass(this.ctx);
    task.ctx = this.ctx;
    await task.subscribe();
    this.success({ taskName, triggered: true });
  }
}
