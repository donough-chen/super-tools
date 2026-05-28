/**
 * 领域事件代码常量
 *  设计依据: docs/superpowers/specs/2026-05-27-积分成长体系后端优化设计文档.md §2.4-#14
 *  实施计划: docs/superpowers/plans/2026-05-27-积分成长体系后端优化-A基础设施实施计划.md Task A3
 *
 *  规则：
 *    - 所有 service.event.emit(code, ...) 必须使用本常量，禁止硬编码字符串
 *    - 与 tasks.trigger_event / domain_events.event_code 字段值严格一致
 *    - 本文件是事件清单的「单一事实源」（Single Source of Truth）
 *
 *  对应任务种子（database/025_points_growth_system_full.sql §4 + 026 §3.5）：
 *    register            -> register_complete (newbie)
 *    profile_completed   -> profile_complete (newbie)
 *    daily_login         -> daily_login_3, year_active
 *    sign                -> daily_sign
 *    sign_streak         -> sign_streak_3 / 7 / 30
 *    tool_used           -> tool_use_first, tool_use_diversity
 *    tool_favorited      -> tool_favorite_3
 *    first_consume       -> first_consume
 *    consume_milestone   -> achieve_consume_500 / 1000 / 3000
 *    first_subscribe     -> first_subscribe
 *    subscribe_renewal   -> subscribe_renewal
 *    feedback_adopted    -> feedback_adopted
 *    refund_completed    -> （Plan B refund.ts emit，无任务，仅审计/通知）
 *    level_up            -> （member.checkAndUpgrade 内部 emit）
 *    points_earned       -> （member.addPoints 内部 emit，预留）
 */
export const EVENT_CODES = {
  /** 用户类 */
  REGISTER: 'register',
  PROFILE_COMPLETED: 'profile_completed',
  DAILY_LOGIN: 'daily_login',

  /** 签到类 */
  SIGN: 'sign',
  SIGN_STREAK: 'sign_streak',

  /** 工具类 */
  TOOL_USED: 'tool_used',
  TOOL_FAVORITED: 'tool_favorited',

  /** 消费类（payment 触发） */
  FIRST_CONSUME: 'first_consume',
  CONSUME_MILESTONE: 'consume_milestone',
  FIRST_SUBSCRIBE: 'first_subscribe',
  SUBSCRIBE_RENEWAL: 'subscribe_renewal',

  /** 反馈类 */
  FEEDBACK_ADOPTED: 'feedback_adopted',

  /** 退款 / 内部 */
  REFUND_COMPLETED: 'refund_completed',
  LEVEL_UP: 'level_up',
  POINTS_EARNED: 'points_earned',

  /**
   * 历史预留 / 暂未启用：邀请首充
   *  - 来源：025 SQL §4 种子任务 invite_first_pay_task（已写入 tasks 表）
   *  - 当前没有 service 端 emit 调用（邀请系统未实现）
   *  - 保留在 EVENT_CODES 里以保证 isValidEventCode 不误报；后续邀请模块上线时直接使用
   */
  INVITE_FIRST_PAY: 'invite_first_pay',
} as const;

export type EventCode = typeof EVENT_CODES[keyof typeof EVENT_CODES];

export const ALL_EVENT_CODES: readonly EventCode[] = Object.freeze(
  Object.values(EVENT_CODES) as EventCode[],
);

/** 类型守卫：判断字符串是否是合法事件代码 */
export function isValidEventCode(code: string): code is EventCode {
  return (ALL_EVENT_CODES as readonly string[]).includes(code);
}
