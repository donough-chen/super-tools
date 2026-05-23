import BaseService, { PaginationResult } from './base';

/** 成长等级权益 */
interface LevelBenefits {
  discount: number;
  daily_sign_points: number;
  max_devices: number;
  ad_free: boolean;
  priority_support: boolean;
  exclusive_content: boolean;
  monthly_coupon: number;
}

/** 付费套餐权益 */
interface PaidBenefits {
  discount_extra: number;
  cloud_storage_gb: number;
  api_rate_limit: number;
  export_pdf: boolean;
  custom_theme: boolean;
  early_access?: boolean;
  founder_badge?: boolean;
}

interface AddPointsParams {
  userId: number;
  points: number;
  growthDelta: number;
  source: string;
  type?: number;
  bizType?: string;
  bizId?: string;
  remark?: string;
}

export default class MemberService extends BaseService {

  // ==================== C 端方法 ====================

  /**
   * 获取会员信息（含下一等级进度）
   */
  async getMemberInfo(userId: number) {
    const member = await this.ctx.model.UserMember.findOne({
      where: { userId },
      include: [{ model: this.ctx.model.MemberLevel, as: 'level' }],
    });
    if (!member) this.ctx.throw(404, '会员记录不存在');

    const memberData = (member as any).toJSON();
    const levelData = memberData.level;

    // 计算下一等级进度
    const nextLevel = await this.ctx.model.MemberLevel.findOne({
      where: { level: levelData.level + 1, status: 1 },
    });

    let nextLevelInfo = null;
    if (nextLevel) {
      const nl = (nextLevel as any).toJSON();
      const remaining = Math.max(0, nl.upgradeGrowth - memberData.growthValue);
      nextLevelInfo = {
        name: nl.name,
        code: nl.code,
        upgradeGrowth: nl.upgradeGrowth,
        progress: nl.upgradeGrowth > 0 ? Math.min(1, memberData.growthValue / nl.upgradeGrowth) : 1,
        remaining,
      };
    }

    // 付费会员信息
    let paidInfo: any = { isPaid: false };
    if (memberData.isPaid && memberData.paidPlanCode) {
      const plan = await this.ctx.model.PaidPlan.findOne({ where: { code: memberData.paidPlanCode } });
      const planData = plan ? (plan as any).toJSON() : null;
      const now = new Date();
      const expireAt = memberData.paidExpireAt ? new Date(memberData.paidExpireAt) : null;
      const isActive = !expireAt || expireAt > now;

      if (isActive) {
        paidInfo = {
          isPaid: true,
          planName: planData?.name || memberData.paidPlanCode,
          planCode: memberData.paidPlanCode,
          startAt: memberData.paidStartAt,
          expireAt: memberData.paidExpireAt,
          remainingDays: expireAt ? Math.ceil((expireAt.getTime() - now.getTime()) / 86400000) : null,
        };
      } else {
        // 过期了，自动标记
        await (member as any).update({ isPaid: 0 });
        paidInfo = { isPaid: false };
      }
    }

    return {
      level: {
        id: levelData.id,
        name: levelData.name,
        code: levelData.code,
        level: levelData.level,
        icon: levelData.icon,
        color: levelData.color,
      },
      growthValue: memberData.growthValue,
      totalPoints: memberData.totalPoints,
      points: memberData.points,
      totalConsume: Number(memberData.totalConsume),
      nextLevel: nextLevelInfo,
      paid: paidInfo,
    };
  }

  /**
   * 获取聚合权益（成长 + 付费合并）
   */
  async getMergedBenefits(userId: number) {
    const member = await this.ctx.model.UserMember.findOne({
      where: { userId },
      include: [{ model: this.ctx.model.MemberLevel, as: 'level' }],
    });
    if (!member) this.ctx.throw(404, '会员记录不存在');
    const memberData = (member as any).toJSON();
    const levelBenefits: LevelBenefits = memberData.level?.benefits || {};

    let paidBenefits: PaidBenefits | null = null;
    if (memberData.isPaid && memberData.paidPlanCode) {
      const now = new Date();
      const expireAt = memberData.paidExpireAt ? new Date(memberData.paidExpireAt) : null;
      const isActive = !expireAt || expireAt > now;
      if (isActive) {
        const plan = await this.ctx.model.PaidPlan.findOne({ where: { code: memberData.paidPlanCode } });
        if (plan) paidBenefits = (plan as any).toJSON().benefits;
      }
    }

    const merged = this.mergeBenefits(levelBenefits, paidBenefits);

    return {
      levelCode: memberData.levelCode,
      isPaid: !!paidBenefits,
      paidPlanCode: paidBenefits ? memberData.paidPlanCode : null,
      benefits: merged,
    };
  }

  /**
   * 获取全部成长等级（公开接口，可缓存）
   */
  async getLevelList() {
    return this.getOrSetCache('member:levels:all', async () => {
      const levels = await this.ctx.model.MemberLevel.findAll({
        where: { status: 1 },
        order: [['level', 'ASC']],
      });
      return levels.map((l: any) => l.toJSON());
    }, 600);
  }

  /**
   * 获取付费套餐列表（公开接口，可缓存）
   */
  async getPlanList() {
    return this.getOrSetCache('member:plans:all', async () => {
      const plans = await this.ctx.model.PaidPlan.findAll({
        where: { status: 1 },
        order: [['sort', 'ASC']],
      });
      return plans.map((p: any) => p.toJSON());
    }, 600);
  }

  /**
   * 获取积分流水（分页）
   */
  async getPointsLogs(userId: number, query: any): Promise<PaginationResult<any>> {
    const { type, startDate, endDate, ...pagination } = query;
    const { Op } = require('sequelize');
    const where: any = { userId };
    if (type !== undefined) where.type = Number(type);
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt[Op.gte] = new Date(startDate);
      if (endDate) where.createdAt[Op.lte] = new Date(endDate + 'T23:59:59');
    }
    return this.paginate(this.ctx.model.PointsLog, { where }, pagination);
  }

  /**
   * 每日签到
   */
  async dailySign(userId: number) {
    const today = new Date().toISOString().slice(0, 10);
    const signKey = `member:sign:${userId}:${today}`;

    // 检查是否已签到（Redis 防重复）
    try {
      const signed = await this.app.redis.get(signKey);
      if (signed) this.ctx.throw(400, '今日已签到');
    } catch (err: any) {
      if (err.status === 400) throw err;
      // Redis 不可用时查数据库
      const { Op } = require('sequelize');
      const todayStart = new Date(today + 'T00:00:00');
      const todayEnd = new Date(today + 'T23:59:59');
      const existing = await this.ctx.model.PointsLog.findOne({
        where: { userId, source: 'daily_login', createdAt: { [Op.between]: [todayStart, todayEnd] } },
      });
      if (existing) this.ctx.throw(400, '今日已签到');
    }

    // 获取该用户的等级权益，确定签到奖励积分
    const member = await this.ctx.model.UserMember.findOne({
      where: { userId },
      include: [{ model: this.ctx.model.MemberLevel, as: 'level' }],
    });
    if (!member) this.ctx.throw(404, '会员记录不存在');
    const memberData = (member as any).toJSON();
    const benefits: LevelBenefits = memberData.level?.benefits || {};
    const signPoints = benefits.daily_sign_points || 1;
    const signGrowth = 1;

    // 增加积分（事务内完成升级检测）
    const result = await this.addPoints({
      userId,
      points: signPoints,
      growthDelta: signGrowth,
      source: 'daily_login',
      remark: `每日签到奖励（${memberData.level?.name || ''}）`,
    });

    // 标记已签到
    try {
      const secondsRemaining = Math.max(1, Math.floor((new Date(today + 'T23:59:59').getTime() - Date.now()) / 1000));
      await this.app.redis.setex(signKey, secondsRemaining, '1');
    } catch { /* ignore */ }

    return {
      pointsEarned: signPoints,
      growthEarned: signGrowth,
      currentPoints: result.currentPoints,
      currentGrowth: result.currentGrowth,
      isLevelUp: result.isLevelUp,
    };
  }

  /**
   * 增加积分 + 成长值（核心方法，事务+行级锁）
   */
  async addPoints(params: AddPointsParams) {
    const { userId, points, growthDelta, source, type = 1, bizType, bizId, remark } = params;

    const result = await this.ctx.model.transaction(async (t: any) => {
      // 行级锁防并发
      const member = await this.ctx.model.UserMember.findOne({
        where: { userId },
        lock: t.LOCK.UPDATE,
        transaction: t,
      });
      if (!member) this.ctx.throw(404, '会员记录不存在');
      const m = (member as any);

      const newPoints = m.points + points;
      const newTotalPoints = m.totalPoints + (points > 0 ? points : 0);
      const newGrowthValue = m.growthValue + (growthDelta > 0 ? growthDelta : 0);

      await m.update({
        points: newPoints,
        totalPoints: newTotalPoints,
        growthValue: newGrowthValue,
      }, { transaction: t });

      // 写入积分流水
      await this.ctx.model.PointsLog.create({
        userId, type, source, points,
        balance: newPoints,
        growthDelta,
        bizType, bizId, remark,
      }, { transaction: t });

      // 检查等级升级
      const levelUpResult = await this.checkAndUpgrade(userId, newGrowthValue, t);

      return {
        currentPoints: newPoints,
        currentGrowth: newGrowthValue,
        isLevelUp: levelUpResult.upgraded,
        newLevel: levelUpResult.newLevel,
      };
    });

    // 事务成功后异步触发积分变动通知（不阻塞主流程）
    try {
      await (this.ctx.service.notification as any).core.send({
        typeCode: 'BUSINESS_POINTS_CHANGE',
        userId,
        variables: {
          changeType: points >= 0 ? '增加' : '扣减',
          points: Math.abs(points),
          balance: result.currentPoints,
          remark: remark || source,
        },
      });
    } catch (e: any) {
      this.ctx.logger.warn(`[member.addPoints] notification failed: ${e.message}`);
    }

    return result;
  }

  /**
   * 消耗积分
   */
  async consumePoints(userId: number, amount: number, source: string, bizType?: string, bizId?: string, remark?: string) {
    if (amount <= 0) this.ctx.throw(400, '消耗积分必须为正数');

    const member = await this.ctx.model.UserMember.findOne({ where: { userId } });
    if (!member) this.ctx.throw(404, '会员记录不存在');
    if ((member as any).points < amount) this.ctx.throw(400, '积分余额不足');

    return this.addPoints({
      userId,
      points: -amount,
      growthDelta: 0,
      source,
      type: 2,
      bizType,
      bizId,
      remark: remark || `消耗积分 ${amount}`,
    });
  }

  /**
   * 等级升级检查（修复设计文档中 level vs levelId 比较的 bug）
   */
  async checkAndUpgrade(userId: number, currentGrowth: number, transaction?: any) {
    const levels = await this.ctx.model.MemberLevel.findAll({
      where: { status: 1 },
      order: [['level', 'DESC']],
    });

    const targetLevel = levels.find((l: any) => currentGrowth >= l.upgradeGrowth);
    if (!targetLevel) return { upgraded: false };

    const member = await this.ctx.model.UserMember.findOne({
      where: { userId },
      include: [{ model: this.ctx.model.MemberLevel, as: 'level' }],
      ...(transaction ? { transaction } : {}),
    });
    const memberData = (member as any).toJSON();
    const currentLevelValue = memberData.level?.level ?? 0;

    if ((targetLevel as any).level > currentLevelValue) {
      const tl = (targetLevel as any);
      await (member as any).update({
        levelId: tl.id,
        levelCode: tl.code,
      }, { ...(transaction ? { transaction } : {}) });

      return { upgraded: true, newLevel: { id: tl.id, name: tl.name, code: tl.code, level: tl.level } };
    }

    return { upgraded: false };
  }

  /**
   * 注册时初始化会员记录
   */
  async initMember(userId: number) {
    const existing = await this.ctx.model.UserMember.findOne({ where: { userId } });
    if (existing) return;

    const giftPoints = 10;
    const giftGrowth = 10;

    // 获取 free 等级 ID
    const freeLevel = await this.ctx.model.MemberLevel.findOne({ where: { code: 'free' } });
    const freeLevelId = freeLevel ? (freeLevel as any).id : 1;

    await this.ctx.model.transaction(async (t: any) => {
      await this.ctx.model.UserMember.create({
        userId,
        levelId: freeLevelId,
        levelCode: 'free',
        growthValue: giftGrowth,
        totalPoints: giftPoints,
        points: giftPoints,
      }, { transaction: t });

      await this.ctx.model.PointsLog.create({
        userId,
        type: 1,
        source: 'register',
        points: giftPoints,
        balance: giftPoints,
        growthDelta: giftGrowth,
        remark: '新用户注册赠送',
      }, { transaction: t });
    });
  }

  /**
   * 开通/续费付费会员（管理员手动或支付回调调用）— Phase 2 扩 mode
   *
   * @param extra.orderId 关联的订单 ID（来自支付回调时传入），用于 PointsLog.bizId 追溯与通知 variables.orderId
   *                       管理员手动开通时不传，向后兼容。
   * @param extra.mode    Phase 2 新增。4 种模式：
   *   - 'new'（默认）：基于"max(curExpireAt, NOW)"叠加 duration（兼容 phase1 行为）
   *   - 'renew'：同 new（语义化别名）
   *   - 'upgrade'：必须传 newExpireAt，以"支付成功时刻 + duration"为新到期（spec § 4.7 规则）
   *   - 'downgrade'：必须传 newExpireAt，剩余价值折算后的天数（来自 priceCalculator）
   * @param extra.newExpireAt upgrade/downgrade 时必填，作为新到期时间
   */
  async activatePaidPlan(
    userId: number,
    planCode: string,
    extra?: {
      orderId?: number;
      mode?: 'new' | 'renew' | 'upgrade' | 'downgrade';
      newExpireAt?: Date;
    },
  ) {
    const mode = extra?.mode || 'new';
    const plan = await this.ctx.model.PaidPlan.findOne({ where: { code: planCode, status: 1 } });
    if (!plan) this.ctx.throw(404, '套餐不存在');
    const planData = (plan as any).toJSON();

    const member = await this.ctx.model.UserMember.findOne({ where: { userId } });
    if (!member) this.ctx.throw(404, '会员记录不存在');

    const now = new Date();
    let expireAt: Date | null = null;

    if (mode === 'upgrade' || mode === 'downgrade') {
      // upgrade / downgrade：使用 caller 计算好的 newExpireAt（来自 priceCalculator）
      if (!extra?.newExpireAt) {
        this.ctx.throw(500, `${mode} 模式必须传入 newExpireAt`);
      }
      expireAt = extra.newExpireAt;
    } else if (planData.durationDays > 0) {
      // new / renew：基于 max(curExpireAt, NOW) + duration（叠加）
      const currentExpire = (member as any).paidExpireAt ? new Date((member as any).paidExpireAt) : null;
      const baseDate = currentExpire && currentExpire > now ? currentExpire : now;
      expireAt = new Date(baseDate.getTime() + planData.durationDays * 86400000);
    }
    // durationDays === 0 = 永久会员，expireAt 保持 null

    await (member as any).update({
      isPaid: 1,
      paidPlanCode: planCode,
      paidStartAt: (member as any).isPaid ? (member as any).paidStartAt : now,
      paidExpireAt: expireAt,
    });

    // 赠送积分和成长值（bizType=order + bizId 优先用订单 ID，便于审计追溯）
    // 注意：升级/降级也赠送（spec 决策保留），如需调整可加 mode 判断
    if (planData.giftPoints > 0 || planData.giftGrowth > 0) {
      await this.addPoints({
        userId,
        points: planData.giftPoints || 0,
        growthDelta: planData.giftGrowth || 0,
        source: 'paid_gift',
        bizType: extra?.orderId ? 'order' : 'subscription',
        bizId: extra?.orderId ? String(extra.orderId) : planCode,
        remark: `${this._modeText(mode)}${planData.name}赠送`,
      });
    }

    // 触发开通套餐通知
    try {
      await this.ctx.service.notification.core.send({
        typeCode: 'BUSINESS_PLAN_ACTIVATED',
        userId,
        variables: {
          planName: planData.name,
          planCode,
          expireAt: expireAt ? expireAt.toISOString().slice(0, 10) : '永久',
          orderId: extra?.orderId,
          mode,
        },
      });
    } catch (e: any) {
      this.ctx.logger.warn(`[member.activatePaidPlan] notification failed: ${e.message}`);
    }

    return {
      planCode,
      planName: planData.name,
      mode,
      startAt: (member as any).paidStartAt || now,
      expireAt,
    };
  }

  /** 翻译 mode → 中文文案（用于 PointsLog.remark） */
  private _modeText(mode: 'new' | 'renew' | 'upgrade' | 'downgrade'): string {
    switch (mode) {
      case 'renew': return '续费';
      case 'upgrade': return '升级';
      case 'downgrade': return '降级';
      default: return '开通';
    }
  }

  // ==================== 管理端方法 ====================

  /**
   * 管理端：会员用户列表
   */
  async getMemberUsers(query: any): Promise<PaginationResult<any>> {
    const { levelCode, isPaid, keyword, ...pagination } = query;
    const { Op } = require('sequelize');
    const where: any = {};
    if (levelCode) where.levelCode = levelCode;
    if (isPaid !== undefined) where.isPaid = Number(isPaid);

    const include: any[] = [
      { model: this.ctx.model.MemberLevel, as: 'level', attributes: ['name', 'code', 'level', 'color'] },
      { model: this.ctx.model.User, as: 'user', attributes: ['id', 'uuid', 'nickname', 'phone', 'email', 'avatar'] },
    ];

    if (keyword) {
      include[1].where = {
        [Op.or]: [
          { nickname: { [Op.like]: `%${keyword}%` } },
          { phone: { [Op.like]: `%${keyword}%` } },
          { email: { [Op.like]: `%${keyword}%` } },
        ],
      };
    }

    return this.paginate(this.ctx.model.UserMember, { where, include }, pagination);
  }

  /**
   * 管理端：手动调整积分
   */
  async adjustPoints(userId: number, points: number, growthDelta: number, remark: string) {
    if (!remark) this.ctx.throw(400, '管理员调整积分必须填写备注');

    return this.addPoints({
      userId,
      points,
      growthDelta,
      source: 'admin',
      type: 4,
      remark,
    });
  }

  /**
   * 管理端：手动调整等级
   */
  async adjustLevel(userId: number, levelId: number) {
    const level = await this.ctx.model.MemberLevel.findByPk(levelId);
    if (!level) this.ctx.throw(404, '等级不存在');

    const member = await this.ctx.model.UserMember.findOne({ where: { userId } });
    if (!member) this.ctx.throw(404, '会员记录不存在');

    const levelData = (level as any).toJSON();
    await (member as any).update({ levelId: levelData.id, levelCode: levelData.code });

    // P2.4: 触发会员升级通知
    try {
      await this.ctx.service.notification.core.send({
        typeCode: 'BUSINESS_MEMBER_UPGRADE',
        userId,
        variables: { levelName: levelData.name, levelCode: levelData.code },
      });
    } catch (e: any) {
      this.ctx.logger.warn(`[member.adjustLevel] notification failed: ${e.message}`);
    }

    return { levelId: levelData.id, levelCode: levelData.code, levelName: levelData.name };
  }

  /**
   * 管理端：更新等级定义
   */
  async updateLevel(id: number, data: any) {
    const level = await this.ctx.model.MemberLevel.findByPk(id);
    if (!level) this.ctx.throw(404, '等级不存在');
    await (level as any).update(data);
    await this.clearCache('member:levels:*');
    return (level as any).toJSON();
  }

  /**
   * 管理端：更新套餐
   */
  async updatePlan(id: number, data: any) {
    const plan = await this.ctx.model.PaidPlan.findByPk(id);
    if (!plan) this.ctx.throw(404, '套餐不存在');
    await (plan as any).update(data);
    await this.clearCache('member:plans:*');
    return (plan as any).toJSON();
  }

  /**
   * 管理端：会员统计
   */
  async getMemberStats() {
    const { fn, col, literal } = require('sequelize');
    const totalMembers = await this.ctx.model.UserMember.count();
    const paidMembers = await this.ctx.model.UserMember.count({ where: { isPaid: 1 } });

    // 等级分布
    const levelDist = await this.ctx.model.UserMember.findAll({
      attributes: ['levelCode', [fn('COUNT', col('id')), 'count']],
      group: ['level_code'],
      raw: true,
    });
    const levelDistribution: Record<string, number> = {};
    levelDist.forEach((d: any) => { levelDistribution[d.levelCode] = Number(d.count); });

    // 今日新增
    const today = new Date().toISOString().slice(0, 10);
    const { Op } = require('sequelize');
    const todayNewMembers = await this.ctx.model.UserMember.count({
      where: { created_at: { [Op.gte]: new Date(today + 'T00:00:00') } } as any,
    });

    return {
      totalMembers,
      paidMembers,
      paidRate: totalMembers > 0 ? Number((paidMembers / totalMembers).toFixed(4)) : 0,
      levelDistribution,
      todayNewMembers,
    };
  }

  /**
   * 管理端：全局积分流水查询
   */
  async getAdminPointsLogs(query: any): Promise<PaginationResult<any>> {
    const { userId, type, source, startDate, endDate, ...pagination } = query;
    const { Op } = require('sequelize');
    const where: any = {};
    if (userId) where.userId = Number(userId);
    if (type !== undefined) where.type = Number(type);
    if (source) where.source = source;
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt[Op.gte] = new Date(startDate);
      if (endDate) where.createdAt[Op.lte] = new Date(endDate + 'T23:59:59');
    }

    return this.paginate(this.ctx.model.PointsLog, { where }, pagination);
  }

  // ==================== 私有方法 ====================

  /**
   * 合并权益（修复设计文档中 || true 的 bug）
   */
  private mergeBenefits(levelBenefits: LevelBenefits, paidBenefits: PaidBenefits | null) {
    const base = {
      discount: levelBenefits.discount ?? 1,
      dailySignPoints: levelBenefits.daily_sign_points ?? 1,
      maxDevices: levelBenefits.max_devices ?? 3,
      adFree: levelBenefits.ad_free ?? false,
      prioritySupport: levelBenefits.priority_support ?? false,
      exclusiveContent: levelBenefits.exclusive_content ?? false,
      monthlyCoupon: levelBenefits.monthly_coupon ?? 0,
      cloudStorageGb: 0,
      apiRateLimit: 100,
      exportPdf: false,
      customTheme: false,
      earlyAccess: false,
      founderBadge: false,
    };

    if (!paidBenefits) return base;

    return {
      ...base,
      discount: Math.max(0, base.discount - (paidBenefits.discount_extra || 0)),
      maxDevices: Math.max(base.maxDevices, 20),
      adFree: true,
      prioritySupport: true,
      exclusiveContent: true,
      cloudStorageGb: paidBenefits.cloud_storage_gb ?? 0,
      apiRateLimit: paidBenefits.api_rate_limit ?? 100,
      exportPdf: paidBenefits.export_pdf ?? false,
      customTheme: paidBenefits.custom_theme ?? false,
      earlyAccess: paidBenefits.early_access ?? false,
      founderBadge: paidBenefits.founder_badge ?? false,
    };
  }
}
