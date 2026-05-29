/**
 * 任务跳转映射
 *
 * 后端 task.code → 前端路由的映射；服务端未提供 jumpPath 字段时由前端兜底。
 * 优先使用 task.jumpPath（如存在），fallback 到本表。
 *
 * Plan: Task 4.3
 */
export const TASK_JUMP_MAP: Record<string, string> = {
  // 新手任务
  new_user_register: '/profile',
  new_user_complete_profile: '/profile',
  new_user_first_sign: '/tasks',
  new_user_first_purchase: '/member/subscribe',
  new_user_first_tool: '/',
  new_user_invite: '/mine',

  // 日常任务
  daily_sign: '/tasks',
  daily_use_tool: '/',
  daily_share: '/',

  // 周任务
  weekly_feedback: '/feedback',
  weekly_invite: '/mine',

  // 成长里程碑
  milestone_consume_500: '/member/subscribe',
  milestone_consume_2000: '/member/subscribe',
  milestone_sign_30: '/tasks',
  milestone_sign_365: '/tasks',
  milestone_invite_10: '/mine',
};

export const resolveTaskJumpPath = (
  task: { code: string; jumpPath?: string },
): string => {
  return task.jumpPath || TASK_JUMP_MAP[task.code] || '/';
};
