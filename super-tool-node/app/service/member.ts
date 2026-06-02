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
  // ============ v2 新增（向后兼容，未传时按旧行为处理）============
  /** 仅“消费类”积分获得场景置 true：order_paid / consume_milestone / first_consume；签到/任务/邀请不叠加倍率 */
  applyMultiplier?: boolean;
  /** 来源事件 code（用于 points_logs.source_event 与 EventService.emit） */
  event?: string;
  /** 升级礼包专用：成长值不计入升级累计（避免连锁升级） */
  skipGrowth?: boolean;
  /** 外部事务（嵌套调用时由调用方传入，不开新事务） */
  transaction?: any;
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
        upgradeGrowth: levelData.upgradeGrowth,
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
   * type 映射：1=sign, 2=consume_reward, 3=task, 4=mall_exchange, 5=expired, 6=admin_adjust, 7=refund
   */
  private readonly TYPE_MAP: Record<number, string> = {
    1: 'sign',
    2: 'consume_reward',
    3: 'task',
    4: 'mall_exchange',
    5: 'expired',
    6: 'admin_adjust',
    7: 'refund',
  };

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
    const result = await this.paginate(this.ctx.model.PointsLog, { where }, pagination);
    // Sequelize 实例 → 普通对象，并做数字 type → 字符串适配
    if (result.list) {
      result.list = result.list.map((log: any) => {
        const plain = log.toJSON ? log.toJSON() : { ...log };
        return {
          ...plain,
          type: this.TYPE_MAP[plain.type] ?? 'other',
          // 确保前端期望的字段存在
          description: plain.remark || '',
          createdAt: plain.createdAt ? new Date(plain.createdAt).toISOString() : '',
          expireAt: plain.expireAt ? new Date(plain.expireAt).toISOString() : null,
        };
      });
    }
    return result;
  }

  /**
   * 每日签到（v2：代理调用 SignService，保留对外 API 兼容）
   * 详见 app/service/sign.ts
   */
  async dailySign(userId: number) {
    const r = await (this.ctx.service as any).sign.dailySign(userId);
    return {
      pointsEarned: r.points,
      growthEarned: 0,
      streak: r.streak,
      signDate: r.signDate,
    };
  }

  /**
   * 增加积分 + 成长值（核心方法，事务+行级锁）
   *
   * v2 改造（依据 docs/superpowers/plans/2026-05-26-积分成长体系MVP实施计划-v2.md §Task 4）：
   *   1. 调 PointsRule 取等级规则；options.applyMultiplier=true 时叠加积分倍率
   *   2. 写 points_logs 时一并写 FIFO 字段（pointsRemaining/status/sourceLevelId/sourceEvent/growthMultiplier）
   *   3. options.skipGrowth=true 时成长值不计入升级累计（升级礼包用）
   *   4. options.transaction 支持事务嵌套（不开新事务）
   *   5. 事务提交后软调 EventService.emit('points_earned', ...) —— T5 完成后自动生效
   */
  async addPoints(params: AddPointsParams) {
    const {
      userId, points, growthDelta, source, type, bizType, bizId, remark,
      applyMultiplier, event, skipGrowth, transaction: outerTx,
    } = params;

    const ownTx = !outerTx;
    const t: any = outerTx || await (this.ctx.model as any).transaction();

    let result: any;
    try {
      // 行级锁防并发
      const member = await this.ctx.model.UserMember.findOne({
        where: { userId },
        lock: t.LOCK.UPDATE,
        transaction: t,
      });
      if (!member) this.ctx.throw(404, '会员记录不存在');
      const m: any = member;

      // 1) 应用等级倍率（仅消费场景且 points>0）
      const rule = await this.ctx.service.pointsRule.getLevelRule(m.levelId);
      const realPoints = (applyMultiplier && points > 0)
        ? this.ctx.service.pointsRule.applyMultiplier(points, rule, { applyMultiplier: true })
        : points;

      // 2) 计算余额变化
      const newBalance = m.points + realPoints;
      const newTotalPoints = m.totalPoints + (realPoints > 0 ? realPoints : 0);
      const realGrowth = skipGrowth ? 0 : Math.max(0, growthDelta);
      const newGrowthValue = m.growthValue + realGrowth;

      const updateData: any = {
        points: newBalance,                       // B2: SIGNED 不再钳零
        totalPoints: newTotalPoints,
      };
      if (realGrowth > 0) updateData.growthValue = newGrowthValue;
      await m.update(updateData, { transaction: t });

      // 3) 写 FIFO 流水
      const inferredType = type ?? (realPoints > 0 ? 1 : (realPoints < 0 ? 2 : 4));
      const expireAt = realPoints > 0 ? this.ctx.service.pointsRule.calcExpireAt(rule) : null;
      const log: any = await this.ctx.model.PointsLog.create({
        userId,
        type: inferredType,
        source,
        points: realPoints,
        balance: newBalance,                       // B2: SIGNED 不再钳零
        growthDelta: skipGrowth ? 0 : (growthDelta || 0),
        bizType,
        bizId,
        remark,
        expireAt,
        // v2 FIFO 字段
        pointsRemaining: realPoints > 0 ? realPoints : 0,
        status: realPoints > 0 ? 1 : 2,
        sourceLevelId: m.levelId,
        sourceEvent: event || source,
        growthMultiplier: rule.pointsMultiplier,
      }, { transaction: t });

      // 4) 等级升级判断（skipGrowth 时不参与）
      let levelUpResult: any = { upgraded: false };
      if (!skipGrowth) {
        levelUpResult = await this.checkAndUpgrade(userId, newGrowthValue, t);
      }

      result = {
        logId: log.id,
        realPoints,                              // v2 新增：实际写入积分（含倍率）
        currentPoints: newBalance,               // B2: SIGNED 不再钳零
        currentGrowth: newGrowthValue,
        isLevelUp: levelUpResult.upgraded,
        newLevel: levelUpResult.newLevel,
      };

      if (ownTx) await t.commit();
    } catch (err) {
      if (ownTx) await t.rollback();
      throw err;
    }

    // 5) 触发领域事件（T5 EventService 完成后自动生效；未完成时静默）
    if (result.realPoints > 0) {
      try {
        const eventSvc = (this.ctx.service as any).event;
        if (eventSvc && typeof eventSvc.emit === 'function') {
          await eventSvc.emit('points_earned', {
            userId, points: result.realPoints, source,
            event: event || source,
          });
        }
      } catch (e: any) {
        this.ctx.logger.warn(`[member.addPoints] event emit failed: ${e.message}`);
      }
    }

    // 6) 异步触发积分变动通知（不阻塞主流程，保留原有行为）
    try {
      await (this.ctx.service.notification as any).core.send({
        typeCode: 'BUSINESS_POINTS_CHANGE',
        userId,
        variables: {
          changeType: result.realPoints >= 0 ? '增加' : '扣减',
          points: Math.abs(result.realPoints),
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
   * 消耗积分（v2 改造：真正的 FIFO 按批次扣减）
   *
   * v2 改造（依据 plan §Task 4 Step 2）：
   *   - 不再调 addPoints；直接锁批次（status=1 AND points_remaining>0）按 expire_at ASC, id ASC 扣
   *   - 扣完一批 status→2；写一条 type=2 的负向流水记录消耗
   *   - 不触发升级、不发倍率、不动 growth_value
   *
   * @param options.allowNegative 是否允许负余额（仅退款场景置 true）
   * @param options.transaction   外部事务
   * @param options.event         来源事件 code（用于 source_event 字段）
   */
  async consumePoints(
    userId: number,
    amount: number,
    source: string,
    bizType?: string,
    bizId?: string,
    remark?: string,
    options: { allowNegative?: boolean; transaction?: any; event?: string } = {},
  ) {
    if (amount <= 0) this.ctx.throw(400, '消耗积分必须为正数');

    const ownTx = !options.transaction;
    const t: any = options.transaction || await (this.ctx.model as any).transaction();
    const { Op } = require('sequelize');

    try {
      const member = await this.ctx.model.UserMember.findOne({
        where: { userId },
        lock: t.LOCK.UPDATE,
        transaction: t,
      });
      if (!member) this.ctx.throw(404, '会员记录不存在');
      const m: any = member;

      if (!options.allowNegative && m.points < amount) {
        this.ctx.throw(400, '积分余额不足');
      }

      // FIFO 扣减：按到期最早 + id 升序锁批次
      let remaining = amount;
      const batches = await this.ctx.model.PointsLog.findAll({
        where: {
          userId,
          status: 1,
          pointsRemaining: { [Op.gt]: 0 },
        },
        order: [
          ['expire_at', 'ASC'],
          ['id', 'ASC'],
        ],
        lock: t.LOCK.UPDATE,
        transaction: t,
      });
      for (const b of batches) {
        if (remaining <= 0) break;
        const bb: any = b;
        const deduct = Math.min(remaining, bb.pointsRemaining);
        const newRemaining = bb.pointsRemaining - deduct;
        await bb.update(
          {
            pointsRemaining: newRemaining,
            status: newRemaining === 0 ? 2 : 1,
          },
          { transaction: t },
        );
        remaining -= deduct;
      }
      // 注：若 allowNegative 且批次扣不够（退款场景），剩余 remaining 视为透支不再扣批次

      const newBalance = m.points - amount;
      // B2 / spec §2.7：026 已 ALTER user_members.points / points_logs.balance 为 SIGNED，允许负值。
      //   - allowNegative=false: 上方已 throw（余额不足），走不到这里
      //   - allowNegative=true （退款透支场景）: 直接写负余额，账本一致
      await m.update(
        { points: newBalance },
        { transaction: t },
      );

      const log: any = await this.ctx.model.PointsLog.create(
        {
          userId,
          type: 2,
          source,
          points: -amount,
          // points_logs.balance 同步写真实值（SIGNED）
          balance: newBalance,
          growthDelta: 0,
          bizType,
          bizId,
          remark: remark || `消耗积分 ${amount}`,
          pointsRemaining: 0,
          status: 2,
          sourceLevelId: m.levelId,
          sourceEvent: options.event || source,
          growthMultiplier: 1.0,
        },
        { transaction: t },
      );

      if (ownTx) await t.commit();

      return {
        logId: log.id,
        currentPoints: newBalance,                // B2: SIGNED 不再钳零
        currentGrowth: m.growthValue,
        isLevelUp: false,
      };
    } catch (err) {
      if (ownTx) await t.rollback();
      throw err;
    }
  }

  /**
   * 退款回扣积分
   *
   * 双分支（feature flag: system_configs.refund.reverse_fifo）：
   *
   *   ┌─ flag=true  → B1 反向 FIFO 账本契约（spec §2.7-#21 / plan B §B1）
   *   │   公式：
   *   │     recoverHere = min(R, B.points - B.pR)
   *   │     overflow    = R - recoverHere
   *   │     new M       = M + R                  // M 一律加全 R（含 overflow）
   *   │     new B.pR    = B.pR + recoverHere     // 不超过 B.points
   *   │   规则：
   *   │     - 不扣成长值（growth_delta=0）
   *   │     - 026 已 ALTER balance 为 SIGNED → 真实负值，无需钳零
   *   │     - 原批次过期不复活：status=3 时仅回写 pR，status 不变
   *   │     - 仅退被退订单的原批次（B2 不动），保持 FIFO 不变
   *   │     - refund 流水 sourceEvent='mall_refund'，metadata 结构化追溯
   *   │     - refund 流水 expireAt 继承原批次（Q-C: 不延长有效期）
   *   │
   *   └─ flag=false → 旧逻辑（向后兼容，已上线流量）
   *       - 原批次 pR 扣完置 status=4（已退款回收）
   *       - balance UNSIGNED 钳零、remark 模板记录欠款
   *       - sourceEvent='refund'、不写 metadata
   */
  async refundPoints(
    userId: number,
    originalLogId: number,
    refundAmount: number,
    options: { remark?: string; transaction?: any } = {},
  ) {
    if (refundAmount <= 0) this.ctx.throw(400, '退款积分必须为正数');

    // === 读 feature flag ===
    const useReverseFifo = await this.getRefundReverseFifoFlag();

    const ownTx = !options.transaction;
    const t: any = options.transaction || await (this.ctx.model as any).transaction();

    try {
      const original: any = await this.ctx.model.PointsLog.findByPk(originalLogId, {
        lock: t.LOCK.UPDATE, transaction: t,
      });
      if (!original) this.ctx.throw(404, '原积分流水不存在');
      if (original.userId !== userId) this.ctx.throw(403, '原流水不属于该用户');

      const member: any = await this.ctx.model.UserMember.findOne({
        where: { userId }, lock: t.LOCK.UPDATE, transaction: t,
      });
      if (!member) this.ctx.throw(404, '会员记录不存在');

      if (useReverseFifo) {
        // ============== 新逻辑（B1 反向 FIFO 账本契约）==============
        const R = refundAmount;
        const batchCapacity = original.points - original.pointsRemaining; // 已被消耗的部分（可回写额度）
        const recoverHere = Math.max(0, Math.min(R, batchCapacity));
        const overflow = R - recoverHere;
        const newBatchRemaining = original.pointsRemaining + recoverHere;
        const newMemberPoints = member.points + R;

        // 1) 回写原批次 pR
        //    - status=1（可用）：回写后若仍 < points 保持 1；若已满（==points）也保持 1
        //    - status=2（已耗尽）：回写后若 > 0 复活到 1
        //    - status=3（已过期）：仅回写 pR，status 不变（账本完整 + FIFO 跳过）
        //    - status=4（已退款回收，旧分支历史枚举）：保持 4 不复活
        let newBatchStatus = original.status;
        if (original.status === 2 && newBatchRemaining > 0) newBatchStatus = 1;
        await original.update(
          { pointsRemaining: newBatchRemaining, status: newBatchStatus },
          { transaction: t },
        );

        // 2) 加会员余额（SIGNED 真实值，含可能的负值场景）
        await member.update({ points: newMemberPoints }, { transaction: t });

        // 3) 写 refund 流水：points=-R, pR=R, balance=new M, expireAt 继承
        const refundLog: any = await this.ctx.model.PointsLog.create(
          {
            userId,
            type: 2,
            source: 'refund',
            points: -R,
            balance: newMemberPoints,
            growthDelta: 0,
            bizType: 'refund',
            bizId: String(originalLogId),
            remark: options.remark || `退款 #${originalLogId} (R=${R}, recoverHere=${recoverHere}, overflow=${overflow})`,
            pointsRemaining: R,
            status: 1,
            sourceLevelId: member.levelId,
            sourceEvent: 'mall_refund',                   // Q-D
            growthMultiplier: original.growthMultiplier || 1.0,
            expireAt: original.expireAt,                  // Q-C: 继承原批次
            metadata: {
              scenario: 'B1_REFUND',
              originalLogId,
              refundAmount: R,
              recoverHere,
              overflow,
            },
          },
          { transaction: t },
        );

        if (ownTx) await t.commit();
        return { logId: refundLog.id, balance: newMemberPoints };
      }

      // ============== 旧逻辑（flag=false，向后兼容）==============
      let toRecover = refundAmount;
      if (original.status === 1 && original.pointsRemaining > 0) {
        const recoverFromBatch = Math.min(toRecover, original.pointsRemaining);
        const newBatchRemaining = original.pointsRemaining - recoverFromBatch;
        await original.update(
          {
            pointsRemaining: newBatchRemaining,
            status: newBatchRemaining === 0 ? 4 : 1,    // 4=已退款回收（旧逻辑保留）
          },
          { transaction: t },
        );
        toRecover -= recoverFromBatch;
      }

      const newBalance = member.points - refundAmount;
      // B2 / spec §2.7：026 已 ALTER user_members.points / points_logs.balance 为 SIGNED，
      //   旧分支同步不再钳零，账本一致。
      await member.update({ points: newBalance }, { transaction: t });

      const log: any = await this.ctx.model.PointsLog.create(
        {
          userId,
          type: 2,
          source: 'refund',
          points: -refundAmount,
          balance: newBalance,
          growthDelta: 0,
          bizType: 'refund',
          bizId: String(originalLogId),
          remark: options.remark || `退款扣回原批次 #${originalLogId}（理论余额 ${newBalance}）`,
          pointsRemaining: 0,
          status: 2,
          sourceLevelId: member.levelId,
          sourceEvent: 'refund',
          growthMultiplier: original.growthMultiplier || 1.0,
        },
        { transaction: t },
      );

      if (ownTx) await t.commit();
      return { logId: log.id, balance: newBalance };
    } catch (err) {
      if (ownTx) await t.rollback();
      throw err;
    }
  }

  /** 读取 system_configs.refund.reverse_fifo flag（兜底 false） */
  private async getRefundReverseFifoFlag(): Promise<boolean> {
    try {
      const rows: any[] = await (this.app.model as any).query(
        "SELECT `value` FROM `system_configs` WHERE `group`='refund' AND `key`='reverse_fifo' LIMIT 1",
        { type: (this.app.model as any).QueryTypes.SELECT },
      );
      if (rows.length > 0 && rows[0].value) return String(rows[0].value).toLowerCase() === 'true';
    } catch { /* ignore */ }
    return false;
  }

  /**
   * 等级升级检查（v2 改造：升级礼包 + 延长有效期 + 升级事件）
   *
   * 改造（依据 plan §Task 4 Step 3）：
   *   1. 升级时发升级礼包（skipGrowth=true 防连锁升级）
   *   2. 软调 pointsExpire.extendExpireOnUpgrade —— T10 完成后自动延长存量积分有效期
   *   3. emit 'level_up' 领域事件 —— T5 完成后自动生效
   *   4. 触发 BUSINESS_LEVEL_UP 站内信通知
   *
   * 保留向后兼容签名：第 2 参数 currentGrowth（外层调用方已传），用于绕开再次查询。
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

    if ((targetLevel as any).level <= currentLevelValue) {
      return { upgraded: false };
    }

    const tl: any = targetLevel;
    const oldLevelId = memberData.levelId;
    await (member as any).update(
      { levelId: tl.id, levelCode: tl.code },
      { ...(transaction ? { transaction } : {}) },
    );

    // === v2 新增：升级礼包 + 延长积分有效期 + 升级事件 ===
    let giftPoints = 0;
    try {
      const newRule = await this.ctx.service.pointsRule.getLevelRule(tl.id);
      giftPoints = newRule.upgradeGiftPoints;

      // 1) 发升级礼包（skipGrowth=true 防连锁升级）
      if (giftPoints > 0) {
        await this.addPoints({
          userId,
          points: giftPoints,
          growthDelta: 0,
          source: 'level_upgrade_gift',
          event: 'level_upgrade_gift',
          skipGrowth: true,
          remark: `升级到 ${tl.name} 赠送积分`,
          transaction,
        });
      }

      // 2) 延长存量积分有效期（T10 PointsExpireService 完成后自动生效）
      const expireSvc = (this.ctx.service as any).pointsExpire;
      if (expireSvc && typeof expireSvc.extendExpireOnUpgrade === 'function') {
        await expireSvc.extendExpireOnUpgrade(userId, newRule, transaction);
      }
    } catch (e: any) {
      this.ctx.logger.warn(`[member.checkAndUpgrade] gift/extend failed: ${e.message}`);
    }

    // 3) emit 'level_up' 领域事件（T5 EventService 完成后自动生效）
    try {
      const eventSvc = (this.ctx.service as any).event;
      if (eventSvc && typeof eventSvc.emit === 'function') {
        await eventSvc.emit('level_up', {
          userId, oldLevelId, newLevelId: tl.id, newLevelCode: tl.code,
        });
      }
    } catch (e: any) {
      this.ctx.logger.warn(`[member.checkAndUpgrade] event emit failed: ${e.message}`);
    }

    // 4) 站内信通知（保留原逻辑，type code 改为 BUSINESS_LEVEL_UP，025 已加 type）
    try {
      await (this.ctx.service.notification as any).core.send({
        typeCode: 'BUSINESS_LEVEL_UP',
        userId,
        variables: { levelName: tl.name, giftPoints },
      });
    } catch (e: any) {
      this.ctx.logger.warn(`[member.checkAndUpgrade] notification failed: ${e.message}`);
    }

    return {
      upgraded: true,
      newLevel: { id: tl.id, name: tl.name, code: tl.code, level: tl.level },
      giftPoints,
    };
  }

  /**
   * 注册时初始化会员记录（v2：FIFO 字段写入 + 读 system_configs）
   *
   * 决策：
   *   - 注册赠送积分/成长值改为读 system_configs（user 回复 A' 把 register_gift_growth 调为 0）
   *   - 写 points_logs 时写 v2 FIFO 字段（pointsRemaining/status/sourceLevelId/sourceEvent/growthMultiplier/expireAt）
   */
  async initMember(userId: number) {
    const existing = await this.ctx.model.UserMember.findOne({ where: { userId } });
    if (existing) return;

    // 读取注册赠送配置（兜底默认 10/0）
    let giftPoints = 10;
    let giftGrowth = 0;
    try {
      const rows: any[] = await this.app.model.query(
        "SELECT `key`, `value` FROM `system_configs` WHERE `group`='member' AND `key` IN ('register_gift_points','register_gift_growth')",
        { type: (this.app.model as any).QueryTypes.SELECT },
      );
      for (const c of rows) {
        if (c.key === 'register_gift_points') giftPoints = Number(c.value) || 0;
        if (c.key === 'register_gift_growth') giftGrowth = Number(c.value) || 0;
      }
    } catch { /* system_configs 不可用时使用默认 */ }

    // 获取 free 等级
    const freeLevel = await this.ctx.model.MemberLevel.findOne({ where: { code: 'free' } });
    const freeLevelId = freeLevel ? (freeLevel as any).id : 1;

    // 计算积分有效期（按 free 等级规则）
    let expireAt: Date | null = null;
    let multiplier = 1.0;
    try {
      const rule = await this.ctx.service.pointsRule.getLevelRule(freeLevelId);
      multiplier = rule.pointsMultiplier;
      if (giftPoints > 0) expireAt = this.ctx.service.pointsRule.calcExpireAt(rule);
    } catch { /* 默认 365 天 */
      if (giftPoints > 0) expireAt = new Date(Date.now() + 365 * 86_400_000);
    }

    await this.ctx.model.transaction(async (t: any) => {
      await this.ctx.model.UserMember.create({
        userId,
        levelId: freeLevelId,
        levelCode: 'free',
        growthValue: giftGrowth,
        totalPoints: giftPoints,
        points: giftPoints,
      }, { transaction: t });

      if (giftPoints > 0 || giftGrowth > 0) {
        await this.ctx.model.PointsLog.create({
          userId,
          type: 1,
          source: 'register',
          points: giftPoints,
          balance: giftPoints,
          growthDelta: giftGrowth,
          remark: '新用户注册赠送',
          expireAt,
          // v2 FIFO 字段
          pointsRemaining: giftPoints,
          status: giftPoints > 0 ? 1 : 2,
          sourceLevelId: freeLevelId,
          sourceEvent: 'register',
          growthMultiplier: multiplier,
        }, { transaction: t });
      }
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
