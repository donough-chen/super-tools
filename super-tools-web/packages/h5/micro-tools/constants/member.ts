import type { MemberLevel } from '@/components/MemberBadge';

/** 将后端等级 code 映射为 MemberLevel 类型 */
export const mapCodeToLevel = (code: string): MemberLevel => {
  const validLevels: MemberLevel[] = ['normal', 'silver', 'gold', 'diamond', 'blackgold'];
  return validLevels.includes(code as MemberLevel) ? (code as MemberLevel) : 'normal';
};

// 权益 key 对应的中文标签
export const BENEFIT_KEY_LABELS: Record<string, string> = {
  points_multiplier: '消费积分倍率',
  points_expire_days: '积分有效期（天）',
  discount: '商城折扣',
  daily_sign_points: '每日签到积分',
  upgrade_gift_points: '升级礼包积分',
  deduct_limit: '抵扣上限',
  max_devices: '最多设备数',
  ad_free: '免广告',
  priority_support: '优先客服',
  exclusive_content: '专属内容',
  monthly_coupon: '每月优惠券',
};

// 快捷入口
export const QUICK_ENTRIES = [
  { key: 'points-logs', label: '积分明细', icon: '📋', path: '/member/points-logs' },
  { key: 'tasks', label: '任务中心', icon: '🎯', path: '/tasks' },
  { key: 'mall', label: '积分商城', icon: '🛍️', path: '/points-mall' },
  { key: 'subscribe', label: '订阅会员', icon: '👑', path: '/member/subscribe' },
];