import BaseService from './base';
import { EVENT_CODES, isValidEventCode, EventCode } from '../lib/eventCodes';

/**
 * 领域事件
 *  设计依据: docs/superpowers/plans/2026-05-26-积分成长体系MVP实施计划-v2.md §Task 5
 *           docs/superpowers/specs/2026-05-27-积分成长体系后端优化设计文档.md §2.4
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
 *  注：A5 之后 emit 时会同步写 domain_events 表 + 校验 code 合法性；
 *      A3 阶段仅引入常量并对未知 code 打 warn，不阻塞。
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
   * 发出领域事件：
   *  1) 同步派发到本进程订阅方（TaskService）
   *  2) 跨 worker 广播（messenger.sendToApp）—— 多 worker 都会收到
   *
   * 幂等性：TaskService.onEvent 通过 user_tasks 唯一索引（user_id+task_code+cycle_key）
   *        + 事务锁保证重复触发不会重复发奖。
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
