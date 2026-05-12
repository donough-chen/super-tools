/**
 * 反馈状态机白名单（与后端 service.feedback._isStatusTransitionAllowed 完全一致）
 *
 * 状态码：
 * - 0=待处理 / 1=处理中 / 2=已回复 / 3=已关闭
 *
 * 规则：
 * - 幂等允许（from === to）
 * - 0/1 → 2 由 reply 独占（前端不允许通过 status 切到 2）
 * - 严格匹配后端，避免前端误发请求被 422 打回
 */
export const STATUS_TRANSITIONS: Record<number, number[]> = {
  0: [1, 3],
  1: [0, 3],
  2: [1],
  3: [1],
};

export const STATUS_LABELS: Record<number, string> = {
  0: '待处理',
  1: '处理中',
  2: '已回复',
  3: '已关闭',
};

export const STATUS_COLORS: Record<number, string> = {
  0: 'default',
  1: 'processing',
  2: 'success',
  3: 'warning',
};

/** 当前 from 状态允许跳转到的 to 状态集合（不含 from === to） */
export function getAllowedTransitions(from: number): number[] {
  return STATUS_TRANSITIONS[from] || [];
}

/** 是否允许 from→to 跳转（含幂等） */
export function isTransitionAllowed(from: number, to: number): boolean {
  if (from === to) return true;
  return getAllowedTransitions(from).includes(to);
}
