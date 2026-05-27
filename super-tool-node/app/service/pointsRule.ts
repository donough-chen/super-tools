import BaseService from './base';

/**
 * 等级规则（来自 member_levels.benefits 的扩展键）
 *  设计来源: docs/analysis/积分与成长体系深度评估报告.md §4.2 / §4.3 / §4.4
 *  种子来源: database/025_add_points_growth_system.sql 末尾 UPDATE member_levels...
 */
export interface LevelRule {
  pointsMultiplier: number;   // 1.00 / 1.10 / 1.30 / 2.00 / 3.00（free/silver/gold/diamond/black）
  taskBonusRate: number;      // 0 / 0.05 / 0.10 / 0.30 / 0.50
  signBasePoints: number;     // 1 / 2 / 3 / 5 / 10
  pointsExpireDays: number;   // 365 / 365 / 456 / 730 / 730
  upgradeGiftPoints: number;  // 0 / 200 / 500 / 2000 / 5000
  upgradeGiftGrowth: number;  // 0（礼包成长值不计入升级累计，固定 0）
  deductLimit: number;        // 0.05 / 0.10 / 0.20 / 0.30 / 0.50
}

const CACHE_TTL_SECONDS = 300;
const CACHE_KEY_PREFIX = 'pointsRule:level:';

export default class PointsRuleService extends BaseService {
  /**
   * 读取等级规则（5 分钟 Redis 缓存，多 worker 一致）
   * @param levelId 等级主键 id（member_levels.id）
   */
  async getLevelRule(levelId: number): Promise<LevelRule> {
    const cacheKey = `${CACHE_KEY_PREFIX}${levelId}`;
    return this.getOrSetCache<LevelRule>(
      cacheKey,
      async () => {
        const level = await this.ctx.model.MemberLevel.findByPk(levelId);
        if (!level) {
          throw new Error(`Level not found: ${levelId}`);
        }
        const benefits: any = (level as any).benefits || {};
        return {
          pointsMultiplier:  Number(benefits.points_multiplier  ?? 1),
          taskBonusRate:     Number(benefits.task_bonus_rate    ?? 0),
          signBasePoints:    Number(benefits.sign_base_points   ?? 1),
          pointsExpireDays:  Number(benefits.points_expire_days ?? 365),
          upgradeGiftPoints: Number(benefits.upgrade_gift_points ?? 0),
          upgradeGiftGrowth: Number(benefits.upgrade_gift_growth ?? 0),
          deductLimit:       Number(benefits.deduct_limit       ?? 0.05),
        };
      },
      CACHE_TTL_SECONDS,
    );
  }

  /**
   * 应用积分倍率（仅"消费类"积分获得场景调用：order_paid / consume_milestone / first_consume...）
   * 签到/任务奖励/邀请奖励 不叠加倍率（避免重复加成）
   */
  applyMultiplier(basePoints: number, rule: LevelRule, options?: { applyMultiplier?: boolean }): number {
    if (!options?.applyMultiplier) return basePoints;
    return Math.floor(basePoints * rule.pointsMultiplier);
  }

  /**
   * 应用任务领奖加成（仅 TaskService.claim 时调用）
   */
  applyTaskBonus(basePoints: number, rule: LevelRule): number {
    return Math.floor(basePoints * (1 + rule.taskBonusRate));
  }

  /**
   * 计算签到当日基础积分（连续里程碑奖励另由任务系统派发，本方法只算每日签到底分）
   */
  calcSignBasePoints(rule: LevelRule): number {
    return rule.signBasePoints;
  }

  /**
   * 计算积分有效期截止时间（按当前等级有效期天数）
   */
  calcExpireAt(rule: LevelRule, from: Date = new Date()): Date {
    return new Date(from.getTime() + rule.pointsExpireDays * 86_400_000);
  }

  /**
   * 计算单笔订单的最大积分抵扣金额（元）
   * @param orderAmount 订单金额（元）
   */
  calcDeductLimit(orderAmount: number, rule: LevelRule): number {
    // 保留 2 位小数，向下取整
    return Math.floor(orderAmount * rule.deductLimit * 100) / 100;
  }

  /**
   * 失效缓存（管理端配置变更 member_levels.benefits 时调用）
   * @param levelId 不传则清空全部等级缓存
   */
  async invalidateCache(levelId?: number): Promise<void> {
    if (levelId) {
      try {
        await this.app.redis.del(`${CACHE_KEY_PREFIX}${levelId}`);
      } catch { /* redis 不可用时静默 */ }
    } else {
      // 清空所有等级缓存
      await this.clearCache(`${CACHE_KEY_PREFIX}*`);
    }
  }
}
