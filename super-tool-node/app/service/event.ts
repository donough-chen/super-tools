import BaseService from './base';

/**
 * 领域事件
 *  设计依据: docs/superpowers/plans/2026-05-26-积分成长体系MVP实施计划-v2.md §Task 5
 *
 *  支持的事件清单（与 tasks.trigger_event 对齐）：
 *    profile_completed / tool_used / tool_favorited / sign / sign_streak /
 *    first_consume / first_subscribe / consume_milestone / invite_first_pay /
 *    feedback_adopted / daily_login / points_earned / level_up
 */
export interface DomainEvent {
  code: string;
  userId: number;
  payload?: any;
  ts?: number;
}

export default class EventService extends BaseService {
  /**
   * 发出领域事件：
   *  1) 同步派发到本进程订阅方（TaskService）
   *  2) 跨 worker 广播（messenger.sendToApp）—— 多 worker 都会收到
   *
   * 幂等性：TaskService.onEvent 通过 user_tasks 唯一索引（user_id+task_code+cycle_key）
   *        + 事务锁保证重复触发不会重复发奖。
   */
  async emit(code: string, payload: { userId: number; [k: string]: any }): Promise<void> {
    const evt: DomainEvent = {
      code,
      userId: payload.userId,
      payload,
      ts: Date.now(),
    };

    // 1) 本进程同步派发（TaskService 已加载时立即生效；T7 完成前为 no-op）
    try {
      const taskSvc: any = (this.ctx.service as any).task;
      if (taskSvc && typeof taskSvc.onEvent === 'function') {
        await taskSvc.onEvent(evt);
      }
    } catch (err: any) {
      this.ctx.logger.error(`[event:${code}] dispatch error: ${err.message}`, err);
    }

    // 2) 跨 worker 广播（防多实例丢事件；幂等已保证）
    try {
      (this.app as any).messenger.sendToApp('domain-event', evt);
    } catch { /* messenger 不可用时静默 */ }
  }
}
