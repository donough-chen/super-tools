/**
 * 订单 / 支付 / 退款 状态映射（管理端共享）
 */

/** 订单状态：0=待支付 1=已支付 2=已取消 3=已过期 4=已退款 */
export const ORDER_STATUS_LABELS: Record<number, string> = {
  0: '待支付',
  1: '已支付',
  2: '已取消',
  3: '已过期',
  4: '已退款',
};

export const ORDER_STATUS_COLORS: Record<number, string> = {
  0: 'orange',
  1: 'green',
  2: 'default',
  3: 'red',
  4: 'purple',
};

/** 支付状态：0=处理中 1=成功 2=失败 3=已退款 */
export const PAYMENT_STATUS_LABELS: Record<number, string> = {
  0: '处理中',
  1: '成功',
  2: '失败',
  3: '已退款',
};

export const PAYMENT_STATUS_COLORS: Record<number, string> = {
  0: 'orange',
  1: 'green',
  2: 'red',
  3: 'purple',
};

/** 订单场景：1=新购 2=续费 3=升级 4=降级（Phase 2 扩展） */
export const SCENE_LABELS: Record<number, string> = {
  1: '新购',
  2: '续费',
  3: '升级',
  4: '降级',
};

export const SCENE_COLORS: Record<number, string> = {
  1: 'blue',
  2: 'green',
  3: 'gold',
  4: 'cyan',
};

/** 退款状态：0=处理中 1=成功 2=失败（Phase 2） */
export const REFUND_STATUS_LABELS: Record<number, string> = {
  0: '处理中',
  1: '成功',
  2: '失败',
};

export const REFUND_STATUS_COLORS: Record<number, string> = {
  0: 'orange',
  1: 'blue',
  2: 'red',
};
