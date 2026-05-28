import BaseService from './base';
import { EVENT_CODES, isValidEventCode, EventCode } from '../lib/eventCodes';

/**
 * 领域事件
 *  设计依据: docs/superpowers/plans/2026-05-26-积分成长体系MVP实施计划-v2.md §Task 5
 *           docs/superpowers/specs/2026-05-27-积分成长体系后端优化设计文档.md §2.4
 *           docs/superpowers/plans/2026-05-27-积分成长体系后端优化-A基础设施实施计划.md Task A5/A6
 *
 *  支持的事件清单：以 app/lib/eventCodes.ts 中 EVENT_CODES 为唯一事实源（共 16 个）：
 *    register / profile_completed / daily_login /
 *    sign / sign_streak /
 *    tool_used / tool_favorited /
 *    first_consume / consume_milestone / first_subscribe / subscribe_renewal /
 *    feedback_adopted /
 *    refund_completed / level_up / points_earned /
 *    invite_first_pay (legacy, 邀请首充, 暂未 emit)
 *
 *  emit 流程（A5 之后）：
 *    1) 写 domain_events 表 status=emitted（追溯 + 重放支持，写库失败仅 warn）
 *    2) 同步派发到本进程订阅方（dispatchInProcess → task.onEvent）
 *    3) 跨 worker 广播（messenger.sendToApp，A6 中其他 worker 订阅）
 *
 *  幂等性：TaskService.onEvent 通过 user_tasks 唯一索引（user_id+task_code+cycle_key）
 *        + 事务锁保证重复触发不会重复发奖。
 */
export interface DomainEvent {
  code: EventCode | string;
  userId: number;
  payload?: any;
  ts?: number;
}

export default class EventService extends BaseService {
  /** Re-export 常量供调用方直接使用：ctx.service.event.codes.SIGN */
  static get codes() { return EVENT_CODES; }

  /**
   * 发出领域事件（业务方主入口）
   */
  async emit(code: string, payload: { userId: number; [k: string]: any }): Promise<void> {
    if (!isValidEventCode(code)) {
      this.ctx.logger.warn(`[event] unknown event code: ${code} (see app/lib/eventCodes.ts)`);
    }

    const evt: DomainEvent = {
      code,
      userId: payload.userId,
      payload,
      ts: Date.now(),
    };

    // 1) 写库（追溯）—— 失败仅 warn，不阻塞业务
    try {
      const DomainEventModel: any = (this.ctx.model as any).DomainEvent;
      if (DomainEventModel && typeof DomainEventModel.create === 'function') {
        await DomainEventModel.create({
          eventCode: code,
          userId: payload.userId,
          payload,
          status: 'emitted',
        });
      }
    } catch (err: any) {
      this.ctx.logger.warn(`[event:${code}] db log failed: ${err.message}`);
    }

    // 2) 本进程同步派发
    await this.dispatchInProcess(evt);

    // 3) 跨 worker 广播（A6 中其他 worker 订阅；幂等已由 user_tasks 保证）
    try {
      (this.app as any).messenger.sendToApp('domain-event', evt);
    } catch { /* messenger 不可用时静默 */ }
  }

  /**
   * 派发事件到本进程订阅方（TaskService）
   *  - emit 内部步骤
   *  - 同时供 A6 messenger 监听方在跨 worker 收到广播后调用
   *
   *  捕获并 log，不再抛出，避免一个订阅方失败影响后续流程。
   */
  async dispatchInProcess(evt: DomainEvent): Promise<void> {
    try {
      const taskSvc: any = (this.ctx.service as any).task;
      if (taskSvc && typeof taskSvc.onEvent === 'function') {
        await taskSvc.onEvent(evt);
      }
    } catch (err: any) {
      this.ctx.logger.error(`[event:${evt.code}] dispatch error: ${err.message}`, err);
    }
  }

  /**
   * messenger 跨 worker 入口（由 app.ts didReady 钩子调用）
   *  当前与 dispatchInProcess 行为等价：因为 worker 之间收到事件后，
   *  应当各自独立派发，由 user_tasks 的唯一索引保证幂等。
   *
   *  之所以单独保留一个方法名而不直接复用 dispatchInProcess：
   *  - 语义上区分"业务侧调用"和"messenger 接收"
   *  - 后续可以加上跳过自身、重放统计等 messenger 专属逻辑
   */
  async dispatchFromMessenger(evt: DomainEvent): Promise<void> {
    await this.dispatchInProcess(evt);
  }
}
