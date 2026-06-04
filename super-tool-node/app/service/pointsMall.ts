import BaseService from './base';

/**
 * 积分商城服务
 *  设计依据: docs/superpowers/plans/2026-05-26-积分成长体系MVP实施计划-v2.md §Task 9
 *
 *  核心设计：
 *    - 兑换全程一个事务：SELECT FOR UPDATE 锁商品 → 校验库存/上限/等级 → 扣积分 →
 *      写商品快照到订单（防止配置漂移）→ 履约（虚拟即时，实物 pending+shipping）
 *    - 退款：实物未发货 / 履约失败 / 管理员主动退款；
 *           调 member.refundPoints 按原批次扣回（不扣成长值，允许负余额）
 *    - 等级门槛：通过 member_levels.level 字段比较（而非 id）
 */
export default class PointsMallService extends BaseService {
  /**
   * 获取会员商城折扣率（使用 member_levels.benefits.discount 字段）
   * 默认 1.00 = 无折扣
   */
  private async getMemberDiscount(userId: number): Promise<number> {
    const member: any = await this.ctx.model.UserMember.findOne({
      where: { userId },
      include: [{ model: this.ctx.model.MemberLevel, as: 'level' }],
    });
    if (!member) return 1.00;
    const benefits = member.level?.benefits;
    if (benefits && typeof benefits === 'object') {
      return parseFloat(benefits.discount ?? 1.00);
    }
    return 1.00;
  }

  /** 计算实际支付积分（应用会员折扣，向下取整，最低1积分） */
  private calcActualPoints(pointsRequired: number, discount: number): number {
    if (discount >= 1.00) return pointsRequired;
    const result = Math.floor(pointsRequired * discount);
    return result > 0 ? result : 1;  // 折扣后至少为 1 积分
  }

  /** C 端：商品列表（按 category 过滤；自动过滤已下架/未上架） */
  async listItems(filter: { category?: string; userId?: number } = {}) {
    const { Op } = require('sequelize');
    const where: any = { status: 1 };
    if (filter.category) where.category = filter.category;
    const now = new Date();
    where[Op.and] = [
      { [Op.or]: [{ validFrom: null }, { validFrom: { [Op.lte]: now } }] },
      { [Op.or]: [{ validTo: null }, { validTo: { [Op.gte]: now } }] },
    ];
    const items = await this.ctx.model.PointsMallItem.findAll({
      where,
      order: [['sort', 'ASC']],
    });

    // 如果传入 userId，计算会员折扣
    let discount = 1.00;
    if (filter.userId) {
      discount = await this.getMemberDiscount(filter.userId);
    }

    return items.map((item: any) => {
      const itemData = item.toJSON();
      const pointsRequired = itemData.pointsRequired || itemData.costPoints;
      const pointsActual = filter.userId
        ? this.calcActualPoints(pointsRequired, discount)
        : pointsRequired;

      return {
        ...itemData,
        pointsRequired,
        pointsActual,
        costPoints: pointsActual,  // 保持前端兼容
      };
    });
  }

  /** 兑换 */
  async exchange(
    userId: number,
    itemId: number,
    deliveryInfo?: {
      receiverName?: string;
      receiverPhone?: string;
      receiverAddress?: string;
    },
  ) {
    return await (this.ctx.model as any).transaction(async (t: any) => {
      // 1) 锁商品
      const item: any = await this.ctx.model.PointsMallItem.findOne({
        where: { id: itemId, status: 1 },
        lock: t.LOCK.UPDATE,
        transaction: t,
      });
      if (!item) this.ctx.throw(404, '商品不存在或已下架');

      // 2) 时间窗校验
      const now = new Date();
      if (item.validFrom && item.validFrom > now) this.ctx.throw(400, '商品未上架');
      if (item.validTo && item.validTo < now) this.ctx.throw(400, '商品已下架');

      // 3) 库存校验
      if (item.stock !== -1 && item.stock <= 0) this.ctx.throw(400, '库存不足');

      // 4) 用户余额/等级 + 计算会员折扣后实际积分
      const member: any = await this.ctx.model.UserMember.findOne({
        where: { userId },
        lock: t.LOCK.UPDATE,
        transaction: t,
      });
      if (!member) this.ctx.throw(404, '用户会员记录不存在');

      // 计算会员折扣后实际支付积分
      const discount = await this.getMemberDiscount(userId);
      const pointsRequired = (item as any).pointsRequired || item.costPoints;
      const pointsActual = this.calcActualPoints(pointsRequired, discount);

      if (member.points < pointsActual) this.ctx.throw(400, '积分不足');

      // 等级门槛：通过 level 字段比较（不是 id）
      if (item.requiredLevel) {
        const requiredLevel: any = await this.ctx.model.MemberLevel.findOne({
          where: { code: item.requiredLevel },
        });
        const myLevel: any = await this.ctx.model.MemberLevel.findByPk(member.levelId);
        if (!requiredLevel || !myLevel || myLevel.level < requiredLevel.level) {
          this.ctx.throw(403, `需 ${item.requiredLevel} 等级`);
        }
      }

      // 5) 限购校验
      const { Op } = require('sequelize');
      if (item.dailyLimit > 0) {
        const dayStart = new Date();
        dayStart.setHours(0, 0, 0, 0);
        const c = await this.ctx.model.PointsMallOrder.count({
          where: {
            userId,
            itemId,
            createdAt: { [Op.gte]: dayStart },
          },
          transaction: t,
        });
        if (c >= item.dailyLimit) this.ctx.throw(400, '已达每日限兑次数');
      }
      if (item.totalLimit > 0) {
        const c = await this.ctx.model.PointsMallOrder.count({
          where: { userId, itemId },
          transaction: t,
        });
        if (c >= item.totalLimit) this.ctx.throw(400, '已达总限兑次数');
      }

      // 6) 实物商品要求收货信息
      if (item.isVirtual === 0) {
        if (!deliveryInfo?.receiverName || !deliveryInfo?.receiverPhone || !deliveryInfo?.receiverAddress) {
          this.ctx.throw(400, '实物商品需要填写收货信息');
        }
      }

      // 7) 扣积分（使用折扣后实际积分）
      const cr: any = await this.ctx.service.member.consumePoints(
        userId,
        pointsActual,
        'mall_exchange',
        'mall',
        String(item.id),
        `兑换：${item.name}`,
        { event: 'mall_exchange', transaction: t },
      );

      // 8) 扣库存
      if (item.stock !== -1) {
        await item.update({ stock: item.stock - 1 }, { transaction: t });
      }

      // 9) 写订单（含商品快照防止配置漂移）
      const orderNo = `PM${Date.now()}${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
      const productSnapshot: any = {
        id: item.id,
        name: item.name,
        icon: item.icon,
        description: item.description,
        category: item.category,
        costPoints: pointsActual,  // 快照记录实际支付积分
        pointsRequired: pointsRequired,  // 快照记录原价积分
        fulfillConfig: item.fulfillConfig,
        isVirtual: item.isVirtual,
      };
      const order: any = await this.ctx.model.PointsMallOrder.create(
        {
          orderNo,
          userId,
          itemId: item.id,
          costPoints: pointsActual,  // 订单记录实际支付积分
          productSnapshot,
          pointsLogId: cr.logId,
          fulfillStatus: 'pending',
          receiverName: deliveryInfo?.receiverName,
          receiverPhone: deliveryInfo?.receiverPhone,
          receiverAddress: deliveryInfo?.receiverAddress,
        },
        { transaction: t },
      );

      // 10) 履约（虚拟商品）
      if (item.isVirtual === 1) {
        try {
          // 传入 order.id 以便 fulfillV
          const result = await this.fulfillVirtual(userId, productSnapshot, t, order.id);
          await order.update(
            {
              fulfillStatus: 'fulfilled',
              fulfillResult: result,
              fulfilledAt: new Date(),
            },
            { transaction: t },
          );
        } catch (err: any) {
          // 履约失败：标记 failed，触发回滚
          await order.update(
            {
              fulfillStatus: 'failed',
              fulfillResult: { error: err.message },
            },
            { transaction: t },
          );
          throw new Error(`履约失败: ${err.message}`);
        }
      } else {
        // 实物商品：等待管理员发货
        await order.update({ fulfillStatus: 'shipping' }, { transaction: t });
      }

      // 11) 通知（不阻塞主流程）
      try {
        await (this.ctx.service.notification as any).core.send({
          typeCode: 'BUSINESS_MALL_FULFILLED',
          userId,
          variables: { itemName: item.name, orderNo },
        });
      } catch { /* ignore */ }

      return {
        orderNo,
        fulfillStatus: order.fulfillStatus,
        balance: cr.currentPoints,
      };
    });
  }

  /** 虚拟商品履约 */
  private async fulfillVirtual(userId: number, snap: any, t: any, orderId?: number): Promise<any> {
    const cfg = snap.fulfillConfig;
    switch (cfg.type) {
      case 'member_days': {
        // 给用户加 N 天 paid 会员（事务内直接 update，不走 activatePaidPlan 避免嵌套通知）
        const member: any = await this.ctx.model.UserMember.findOne({
          where: { userId },
          lock: t.LOCK.UPDATE,
          transaction: t,
        });
        const now = new Date();
        const base = (member.paidExpireAt && member.paidExpireAt > now) ? member.paidExpireAt : now;
        const newExpire = new Date(new Date(base).getTime() + cfg.days * 86_400_000);
        await member.update(
          {
            isPaid: 1,
            paidPlanCode: cfg.plan_code,
            paidStartAt: member.paidStartAt || now,
            paidExpireAt: newExpire,
          },
          { transaction: t },
        );
        return { type: 'member_days', planCode: cfg.plan_code, days: cfg.days, expireAt: newExpire };
      }
      case 'coupon': {
        // 写入 user_coupons 表
        const couponCode = `CP${Date.now()}${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
        const validDays = cfg.valid_days || 30;
        const expireAt = new Date(Date.now() + validDays * 86_400_000);
        const couponType = cfg.discount >= 1 ? 'fixed' : 'percent';
        await this.ctx.model.UserCoupon.create(
          {
            userId,
            orderId: orderId || 0,
            couponCode,
            couponType,
            discount: cfg.discount,
            threshold: cfg.threshold || 0,
            expireAt,
          },
          { transaction: t },
        );
        return {
          type: 'coupon',
          couponCode,
          couponType,
          discount: cfg.discount,
          threshold: cfg.threshold || 0,
          expireAt: expireAt.toISOString(),
        };
      }
      case 'tool_unlock': {
        // 写入 user_tool_unlocks 表
        const validDays = cfg.days || 7;
        const now = new Date();
        const expireAt = new Date(now.getTime() + validDays * 86_400_000);
        await this.ctx.model.UserToolUnlock.create(
          {
            userId,
            orderId: orderId || 0,
            toolCode: cfg.tool_code,
            unlockDays: validDays,
            unlockedAt: now,
            expireAt,
          },
          { transaction: t },
        );
        return {
          type: 'tool_unlock',
          toolCode: cfg.tool_code,
          days: validDays,
          expireAt: expireAt.toISOString(),
        };
      }
      case 'badge': {
        return { type: 'badge', badgeCode: cfg.badge_code };
      }
      default:
        throw new Error(`未知履约类型: ${cfg.type}`);
    }
  }

  /** 我的兑换记录（分页） */
  async listMyOrders(
    userId: number,
    options: { page?: number; pageSize?: number } = {},
  ) {
    const page = options.page || 1;
    const pageSize = Math.min(options.pageSize || 20, 100);
    return await this.ctx.model.PointsMallOrder.findAndCountAll({
      where: { userId },
      order: [['created_at', 'DESC']],
      limit: pageSize,
      offset: (page - 1) * pageSize,
    });
  }

  /** 订单详情（C 端：仅自己） */
  async getMyOrder(userId: number, orderNo: string) {
    return await this.ctx.model.PointsMallOrder.findOne({
      where: { userId, orderNo },
    });
  }

  // ==================== 用户券管理 ====================

  /** 获取用户已解锁工具列表（返回 toolCode 数组） */
  async getUserUnlockedTools(userId: number): Promise<string[]> {
    const { Op } = require('sequelize');
    const now = new Date();
    const unlocks = await this.ctx.model.UserToolUnlock.findAll({
      where: {
        userId,
        status: 'active',
        expireAt: { [Op.gte]: now },
      },
      attributes: ['toolCode'],
    });
    return unlocks.map((u: any) => u.toolCode);
  }

  /** 获取用户可用券列表 */
  async getUserCoupons(userId: number, options: { status?: string } = {}) {
    const { Op } = require('sequelize');
    const where: any = { userId };
    if (options.status === 'unused') {
      where.status = 'unused';
      where.expireAt = { [Op.gte]: new Date() };
    } else if (options.status === 'used') {
      where.status = 'used';
    } else if (options.status === 'expired') {
      where.status = 'expired';
      where.expireAt = { [Op.lt]: new Date() };
    }
    return await this.ctx.model.UserCoupon.findAll({
      where,
      order: [['created_at', 'DESC']],
    });
  }

  /**
   * 使用券（下单时调用）
   * @returns { couponId, discountAmount } 或 null（无可使用券）
   */
  async useCoupon(userId: number, orderAmount: number, couponId?: number): Promise<{ couponId: number; discountAmount: number } | null> {
    const { Op } = require('sequelize');
    const now = new Date();

    let coupon: any;
    if (couponId) {
      // 指定券使用
      coupon = await this.ctx.model.UserCoupon.findOne({
        where: { id: couponId, userId, status: 'unused', expireAt: { [Op.gte]: now } },
      });
    } else {
      // 自动选最优券（折扣金额最大）
      const coupons = await this.ctx.model.UserCoupon.findAll({
        where: {
          userId,
          status: 'unused',
          expireAt: { [Op.gte]: now },
          threshold: { [Op.lte]: orderAmount },
        },
        order: [['discount', 'DESC']],
      });
      coupon = coupons[0] || null;
    }

    if (!coupon) return null;
    if (coupon.threshold > 0 && orderAmount < coupon.threshold) return null;

    // 计算优惠金额
    let discountAmount: number;
    if (coupon.couponType === 'percent') {
      discountAmount = Math.floor(orderAmount * (1 - coupon.discount));
    } else {
      discountAmount = coupon.discount; // fixed 类型，discount 字段存减免金额
    }
    if (discountAmount <= 0) return null;

    // 标记已使用
    await coupon.update({ status: 'used', usedAt: now });

    return { couponId: coupon.id, discountAmount };
  }

  /** 退款（管理端） */
  async refund(orderId: number, reason: string) {
    return await (this.ctx.model as any).transaction(async (t: any) => {
      const order: any = await this.ctx.model.PointsMallOrder.findByPk(orderId, {
        lock: t.LOCK.UPDATE, transaction: t,
      });
      if (!order) this.ctx.throw(404, '订单不存在');
      if (order.refundStatus !== 'none') this.ctx.throw(400, '订单已退款或正在退款');

      // 虚拟商品已履约不可退（权益已发放无法回收）
      if (order.fulfillStatus === 'fulfilled' && order.productSnapshot?.isVirtual === 1) {
        this.ctx.throw(400, '虚拟商品已履约不可退款');
      }

      // 退积分（按原 logId 折算）
      if (order.pointsLogId) {
        await this.ctx.service.member.refundPoints(
          order.userId,
          order.pointsLogId,
          order.costPoints,
          {
            remark: `商城订单退款：${order.orderNo} - ${reason}`,
            transaction: t,
          },
        );
      }

      // 还库存
      const item: any = await this.ctx.model.PointsMallItem.findByPk(order.itemId, {
        lock: t.LOCK.UPDATE, transaction: t,
      });
      if (item && item.stock !== -1) {
        await item.update({ stock: item.stock + 1 }, { transaction: t });
      }

      await order.update(
        {
          refundStatus: 'refunded',
          refundReason: reason,
          refundedAt: new Date(),
          fulfillStatus: 'refunded',
        },
        { transaction: t },
      );

      return { orderNo: order.orderNo, refundedPoints: order.costPoints };
    });
  }
}
