/**
 * 会员模块格式化工具（Spec-C2b 引入）
 */

/** 格式化货币（DECIMAL string / number → ¥xxx.xx） */
export function formatCurrency(v: string | number | undefined | null): string {
  if (v == null) return '-';
  const n = typeof v === 'string' ? parseFloat(v) : v;
  if (isNaN(n)) return '-';
  return `¥${n.toFixed(2)}`;
}

/** 格式化时长（年/月/天，0 视为永久） */
export function formatDuration(days: number | undefined | null): string {
  if (days == null) return '-';
  if (days === 0) return '永久';
  if (days >= 365 && days % 365 === 0) return `${days / 365} 年`;
  if (days >= 30 && days % 30 === 0) return `${days / 30} 月`;
  return `${days} 天`;
}

/** 等级颜色降级（color 缺失时返回 fallback，默认 #999） */
export function levelColor(color?: string, fallback = '#999'): string {
  return color || fallback;
}

/** 积分流水类型映射 */
export const POINTS_TYPE_LABELS: Record<number, string> = {
  0: '支出',
  1: '收入',
};

export const POINTS_TYPE_COLORS: Record<number, string> = {
  0: 'red',
  1: 'green',
};
