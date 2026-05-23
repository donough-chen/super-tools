/**
 * 升降级价格计算器（Q10=A 剩余价值折算法）
 *
 * 核心公式：
 *   remainingValue = currentPlan.price * (remainingDays / currentPlan.durationDays)
 *
 * 4 个场景：
 *   场景 1（新购）：未付费用户 → amount = newPlan.price，newExpireAt = NOW + duration
 *   场景 2（续费）：付费用户买同套餐 → amount = newPlan.price，newExpireAt = 旧 expire + duration（叠加）
 *   场景 3（升级）：newPlan.price > remainingValue → amount = newPlan.price - remainingValue，newExpireAt = NOW + duration
 *   场景 4（降级）：newPlan.price <= remainingValue → amount = 0，newExpireAt = NOW + 折算天数
 *     daysFromValue = floor((remainingValue / newPlan.price) * newPlan.durationDays)
 *
 * 不变量：
 *   - 永久会员（durationDays === 0）不允许升降级 → 抛错
 *   - amount 始终保留 2 位小数
 *   - remainingDays 向上取整（保护用户）
 */

export interface PlanInfo {
  code: string;
  price: number;          // 元
  durationDays: number;   // 0 = 永久（不参与升降级）
}

export interface MemberSnapshot {
  paidPlanCode?: string | null;
  paidExpireAt?: Date | string | null;
}

export interface SwitchCalcResult {
  scene: 1 | 2 | 3 | 4;
  /** 应付金额（元，保留 2 位小数；scene=4 时为 0） */
  amount: number;
  /** 剩余天数（向上取整） */
  remainingDays: number;
  /** 剩余价值（元，保留 2 位小数；新购/续费 = 0） */
  remainingValue: number;
  /** 计算后的新到期时间 */
  newExpireAt: Date;
  /** 文案（管理端 / H5 dryRun 展示） */
  reason: string;
}

export function calcSwitchPlan(opts: {
  currentMember: MemberSnapshot;
  currentPlan?: PlanInfo;
  newPlan: PlanInfo;
  now?: Date;
}): SwitchCalcResult {
  const now = opts.now || new Date();
  const { currentMember, currentPlan, newPlan } = opts;

  // 场景 1：未付费 / 已过期
  const isPaid = !!(
    currentMember.paidPlanCode &&
    currentMember.paidExpireAt &&
    new Date(currentMember.paidExpireAt) > now
  );
  if (!isPaid) {
    return {
      scene: 1,
      amount: newPlan.price,
      remainingDays: 0,
      remainingValue: 0,
      newExpireAt: addDays(now, newPlan.durationDays),
      reason: '新购',
    };
  }

  // 场景 2：同套餐续费 — 在旧 expireAt 基础上叠加新 duration
  if (currentMember.paidPlanCode === newPlan.code) {
    const oldExpire = new Date(currentMember.paidExpireAt!);
    return {
      scene: 2,
      amount: newPlan.price,
      remainingDays: diffDays(oldExpire, now),
      remainingValue: 0,
      newExpireAt: addDays(oldExpire, newPlan.durationDays),
      reason: '续费（叠加剩余天数）',
    };
  }

  // 场景 3 / 4：跨套餐
  if (!currentPlan || currentPlan.durationDays === 0) {
    throw new Error('当前为永久套餐或不可识别套餐，不支持升降级');
  }
  // 永久新套餐：当前若是付费会员，应当作升级（差价 = lifetime price - remainingValue）
  // 永久也支持升级到，但需要 currentPlan 有效（不是永久）
  const remainingDays = diffDays(new Date(currentMember.paidExpireAt!), now);
  const remainingValue = round2(currentPlan.price * (remainingDays / currentPlan.durationDays));

  if (newPlan.price > remainingValue) {
    return {
      scene: 3,
      amount: round2(newPlan.price - remainingValue),
      remainingDays,
      remainingValue,
      newExpireAt: newPlan.durationDays === 0
        ? new Date('2099-12-31T23:59:59Z')
        : addDays(now, newPlan.durationDays),
      reason: `升级（差价 = ${newPlan.price.toFixed(2)} - ${remainingValue.toFixed(2)}）`,
    };
  }

  // 降级：剩余价值折算成新套餐的天数
  const daysFromValue = Math.floor((remainingValue / newPlan.price) * newPlan.durationDays);
  return {
    scene: 4,
    amount: 0,
    remainingDays,
    remainingValue,
    newExpireAt: addDays(now, daysFromValue),
    reason: `降级（剩余价值 ${remainingValue.toFixed(2)} 折算 ${daysFromValue} 天）`,
  };
}

// ---------- helpers ----------

function diffDays(future: Date, base: Date): number {
  const diff = (future.getTime() - base.getTime()) / 86400000;
  return Math.max(0, Math.ceil(diff));
}

function addDays(d: Date, days: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + days);
  return r;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
