/**
 * PriceCalculator 单测 — 4 scene + 边界 / 永久会员错误
 */
import { calcSwitchPlan, PlanInfo } from '../../../app/lib/payment/priceCalculator';

const monthlyPlan: PlanInfo = { code: 'monthly', price: 6.8, durationDays: 30 };
const yearlyPlan: PlanInfo = { code: 'yearly', price: 68, durationDays: 365 };
const lifetimePlan: PlanInfo = { code: 'lifetime', price: 999, durationDays: 0 };

const NOW = new Date('2026-05-23T00:00:00Z');
const ONE_DAY = 86400000;

describe('calcSwitchPlan', () => {
  it('未付费用户 → scene=1 新购', () => {
    const r = calcSwitchPlan({
      currentMember: { paidPlanCode: null, paidExpireAt: null },
      newPlan: monthlyPlan,
      now: NOW,
    });
    expect(r.scene).toBe(1);
    expect(r.amount).toBe(6.8);
    expect(r.remainingValue).toBe(0);
    expect(r.remainingDays).toBe(0);
    // 新到期时间 = NOW + 30 天
    const days = Math.round((r.newExpireAt.getTime() - NOW.getTime()) / ONE_DAY);
    expect(days).toBe(30);
  });

  it('付费已过期 → scene=1 新购', () => {
    const r = calcSwitchPlan({
      currentMember: { paidPlanCode: 'monthly', paidExpireAt: '2026-05-01T00:00:00Z' },
      newPlan: monthlyPlan,
      now: NOW,
    });
    expect(r.scene).toBe(1);
    expect(r.amount).toBe(6.8);
  });

  it('付费同套餐 → scene=2 续费（叠加剩余天数）', () => {
    const expireAt = new Date(NOW.getTime() + 30 * ONE_DAY); // 还剩 30 天
    const r = calcSwitchPlan({
      currentMember: { paidPlanCode: 'monthly', paidExpireAt: expireAt },
      currentPlan: monthlyPlan,
      newPlan: monthlyPlan,
      now: NOW,
    });
    expect(r.scene).toBe(2);
    expect(r.amount).toBe(6.8);
    expect(r.remainingDays).toBe(30);
    // 新到期时间 = 旧 expire + 30 天 = NOW + 60 天
    const days = Math.round((r.newExpireAt.getTime() - NOW.getTime()) / ONE_DAY);
    expect(days).toBe(60);
  });

  it('付费 monthly → 升级 yearly → scene=3 + 差价计算正确', () => {
    // monthly 还剩 25 天 → remainingValue = 6.8 * 25/30 ≈ 5.67
    // 差价 = 68 - 5.67 = 62.33
    const expireAt = new Date(NOW.getTime() + 25 * ONE_DAY);
    const r = calcSwitchPlan({
      currentMember: { paidPlanCode: 'monthly', paidExpireAt: expireAt },
      currentPlan: monthlyPlan,
      newPlan: yearlyPlan,
      now: NOW,
    });
    expect(r.scene).toBe(3);
    expect(r.remainingDays).toBe(25);
    expect(r.remainingValue).toBeCloseTo(5.67, 1);
    expect(r.amount).toBeCloseTo(62.33, 1);
    // 升级以 NOW 为基准 → 新到期 = NOW + 365 天
    const days = Math.round((r.newExpireAt.getTime() - NOW.getTime()) / ONE_DAY);
    expect(days).toBe(365);
  });

  it('付费 yearly → 降级 monthly → scene=4 + amount=0 + 折算天数', () => {
    // yearly 还剩 200 天 → remainingValue = 68 * 200/365 ≈ 37.26
    // 折算天数 = floor(37.26 / 6.8 * 30) ≈ 164 天
    const expireAt = new Date(NOW.getTime() + 200 * ONE_DAY);
    const r = calcSwitchPlan({
      currentMember: { paidPlanCode: 'yearly', paidExpireAt: expireAt },
      currentPlan: yearlyPlan,
      newPlan: monthlyPlan,
      now: NOW,
    });
    expect(r.scene).toBe(4);
    expect(r.amount).toBe(0);
    expect(r.remainingValue).toBeCloseTo(37.26, 1);
    // 折算天数应在 [160, 170] 范围
    const daysFromValue = Math.round((r.newExpireAt.getTime() - NOW.getTime()) / ONE_DAY);
    expect(daysFromValue).toBeGreaterThanOrEqual(160);
    expect(daysFromValue).toBeLessThanOrEqual(170);
  });

  it('永久会员降级抛错', () => {
    expect(() => calcSwitchPlan({
      currentMember: { paidPlanCode: 'lifetime', paidExpireAt: new Date('2099-12-31') },
      currentPlan: lifetimePlan,
      newPlan: monthlyPlan,
      now: NOW,
    })).toThrow(/永久/);
  });

  it('remainingDays=1 边界（明天到期）', () => {
    const expireAt = new Date(NOW.getTime() + 1000); // 还有 < 1 天
    const r = calcSwitchPlan({
      currentMember: { paidPlanCode: 'monthly', paidExpireAt: expireAt },
      currentPlan: monthlyPlan,
      newPlan: yearlyPlan,
      now: NOW,
    });
    // ceil(1/86400000) = 1 day
    expect(r.scene).toBe(3);
    expect(r.remainingDays).toBe(1);
    // remainingValue = 6.8 * 1/30 ≈ 0.23
    expect(r.remainingValue).toBeCloseTo(0.23, 1);
    // 差价 = 68 - 0.23 ≈ 67.77
    expect(r.amount).toBeCloseTo(67.77, 1);
  });

  it('newExpireAt 升级以 NOW 为基准（不叠加）', () => {
    const expireAt = new Date(NOW.getTime() + 25 * ONE_DAY);
    const r = calcSwitchPlan({
      currentMember: { paidPlanCode: 'monthly', paidExpireAt: expireAt },
      currentPlan: monthlyPlan,
      newPlan: yearlyPlan,
      now: NOW,
    });
    const daysFromNow = Math.round((r.newExpireAt.getTime() - NOW.getTime()) / ONE_DAY);
    // 升级是 NOW + 365 天，不是 expireAt + 365
    expect(daysFromNow).toBe(365);
  });
});
