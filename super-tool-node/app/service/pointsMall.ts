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
  /** C 端：商品列表（按 category 过滤；自动过滤已下架/未上架） */
  async listItems(filter: { category?: string } = {}) {
    const { Op } = require('sequelize');
    const where: any = { status: 1 };
    if (filter.category) where.category = filter.category;
    const now = new Date();
    where[Op.and] = [
      { [Op.or]: [{ validFrom: null }, { validFrom: { [Op.lte]: now } }] },
      { [Op.or]: [{ validTo: null }, { validTo: { [Op.gte]: now } }] },
    ];
    return await this.ctx.model.PointsMallItem.findAll({
      where,
      order: [['sort', 'ASC']],
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

      // 4) 用户余额/等级
      const member: any = await this.ctx.model.UserMember.findOne({
        where: { userId },
        lock: t.LOCK.UPDATE,
        transaction: t,
      });
      if (!member) this.ctx.throw(404, '用户会员记录不存在');
      if (member.points < item.costPoints) this.ctx.throw(400, '积分不足');

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

      // 7) 扣积分（v2 签名：consumePoints(userId, amount, source, bizType?, bizId?, remark?, options?)）
      const cr: any = await this.ctx.service.member.consumePoints(
        userId,
        item.costPoints,
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
      const productSnapshot = {
        id: item.id,
        name: item.name,
        icon: item.icon,
        description: item.description,
        category: item.category,
        costPoints: item.costPoints,
        fulfillConfig: item.fulfillConfig,
        isVirtual: item.isVirtual,
      };
      const order: any = await this.ctx.model.PointsMallOrder.create(
        {
          orderNo,
          userId,
          itemId: item.id,
          costPoints: item.costPoints,
          productSnapshot,
          pointsLogId: cr.logId,
          fulfillStatus: 'pending',
          receiverName: deliveryInfo?.receiverName,
          receiverPhone: deliveryInfo?.receiverPhone,
          receiverAddress: deliveryInfo?.receiverAddress,
        },
        { transaction: t },
      );

      // 10) 履约
      if (item.isVirtual === 1) {
        try {
          const result = await this.fulfillVirtual(userId, productSnapshot, t);
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
  private async fulfillVirtual(userId: number, snap: any, t: any): Promise<any> {
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
        // MVP：暂未单独建 coupons 表，仅记录到 fulfillResult；后续可建表后改写入 coupons
        return {
          type: 'coupon',
          couponCode: `CP${Date.now()}${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
          ...cfg,
        };
      }
      case 'tool_unlock': {
        return {
          type: 'tool_unlock',
          toolCode: cfg.tool_code,
          days: cfg.days,
          expireAt: new Date(Date.now() + cfg.days * 86_400_000),
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
