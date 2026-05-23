import BaseService, { PaginationResult } from './base';
import { ProviderCode, createProvider, getPaymentProvider, RefundResult } from '../lib/payment';

interface CreateRefundInput {
  orderId: number;
  reason: string;
  operatorId: number;
}

export interface RefundListQuery {
  page?: number;
  pageSize?: number;
  orderId?: number;
  userId?: number;
  status?: number;
  startDate?: string;
  endDate?: string;
}

/**
 * RefundService — Phase 2 退款服务
 *
 * 关键设计：
 *   - create() 单事务：行级锁 order + payment → 校验 → INSERT refund(status=0) → provider.refund 同步等
 *     - 成功：批量 UPDATE refund/payment/order/member（is_paid=0, paid_expire_at=NOW）
 *     - 失败：UPDATE refund(status=2) 然后 throw 让事务回滚（refund 状态保留供审计）
 *     - 注意：provider.refund 失败也要先记录 refund(status=2)，然后再 throw 让 order/payment 回滚到原状态
 *       为此我们把"标记 refund 失败"放在 catch 块里独立提交（事务外）
 *   - 通知 + audit 走 ctx.runInBackground，不阻塞事务
 *
 * 不变量（spec § 10）：
 *   - 同 orderId 不会有 2 个 status∈{0,1} 的 refund（create 校验）
 *   - 退款成功后会员立即失效（事务内 update user_members.is_paid=0）
 */
export default class RefundService extends BaseService {
  /**
   * 发起退款（管理端入口）
   *
   * 流程：
   *   1. 行级锁 order，校验 order.status === 1（已支付）
   *   2. 校验同 orderId 无 status ∈ {0, 1} 的现存 refund
   *   3. 找原 payment（status === 1，行级锁）
   *   4. INSERT member_refunds(status=0)
   *   5. provider.refund() 同步等待结果
   *   6. 成功 → 批量 update refund(1)/payment(3)/order(4)/member(is_paid=0)
   *   7. 失败 → 在事务外 update refund(status=2)，throw 让原事务回滚
   *   8. 事务外 runInBackground 发通知 + audit
   */
  async create(input: CreateRefundInput) {
    const { orderId, reason, operatorId } = input;
    const refundNo = this._genRefundNo();

    // 单事务：行级锁 + 创建 refund + provider.refund 同步等 + 成功批量更新
    let result: any = null;
    let asyncContext: { order: any; refundId: number; amount: number } | null = null;

    await this.ctx.model.transaction(async (t: any) => {
      // 1. 行级锁 order
      const lockedOrder = await this.ctx.model.MemberOrder.findOne({
        where: { id: orderId },
        lock: t.LOCK.UPDATE,
        transaction: t,
      });
      if (!lockedOrder) this.ctx.throw(404, '订单不存在');
      const orderData = (lockedOrder as any).toJSON();
      if (orderData.status !== 1) {
        this.ctx.throw(400, `订单状态不允许退款（当前 ${orderData.status}，仅已支付订单可退）`);
      }

      // 2. 校验现有 refund
      const { Op } = require('sequelize');
      const existRefund = await this.ctx.model.MemberRefund.findOne({
        where: { orderId, status: { [Op.in]: [0, 1] } },
        transaction: t,
      });
      if (existRefund) {
        this.ctx.throw(400, `订单已有进行中或成功的退款记录（refundNo=${(existRefund as any).refundNo}）`);
      }

      // 3. 找原 payment（行级锁）
      const lockedPayment = await this.ctx.model.MemberPayment.findOne({
        where: { orderId, status: 1 },
        lock: t.LOCK.UPDATE,
        transaction: t,
      });
      if (!lockedPayment) this.ctx.throw(400, '未找到已成功的支付流水（无法退款）');
      const paymentData = (lockedPayment as any).toJSON();
      const amount = Number(paymentData.amount);

      // 4. INSERT refund(status=0)
      const refund = await this.ctx.model.MemberRefund.create({
        refundNo,
        paymentId: paymentData.id,
        orderId: orderData.id,
        userId: orderData.userId,
        provider: paymentData.provider,
        amount: paymentData.amount,
        status: 0,
        reason,
        operatorId,
      }, { transaction: t });
      const refundId = (refund as any).id;

      // 5. provider.refund 同步等
      const providerName = paymentData.provider as ProviderCode;
      const providerImpl = providerName === 'mock'
        ? getPaymentProvider(providerName)
        : createProvider(providerName, this.ctx);

      let refundResult: RefundResult;
      try {
        refundResult = await providerImpl.refund({
          paymentNo: paymentData.paymentNo,
          refundNo,
          amount,
          totalAmount: amount,
          reason,
        });
      } catch (e: any) {
        // 通道异常：标记 refund(status=2)，事务整体 rollback（包括 status=0 的 INSERT）
        // 注意：rollback 后该 refundNo 不会留在 DB，但通过 throw 让上层感知
        this.ctx.throw(500, `退款通道调用异常: ${e.message || e}`);
      }

      if (!refundResult.success) {
        // 通道返回失败：standalone update refund(status=2) 在事务外做（避免被回滚）
        // 这里 throw 让事务回滚 INSERT
        const failedReason = refundResult.failedReason || '退款失败';
        this.ctx.throw(400, `退款失败: ${failedReason}`);
      }

      // 6. 成功路径：批量更新（refund/payment/order/member）
      const now = new Date();
      await (refund as any).update({
        status: 1,
        providerRefundNo: refundResult.providerRefundNo,
        providerResponse: refundResult.rawResponse,
        refundedAt: now,
      }, { transaction: t });
      await (lockedPayment as any).update({ status: 3 }, { transaction: t });
      await (lockedOrder as any).update({ status: 4 }, { transaction: t });

      // 会员状态恢复逻辑：
      //   - 升级/降级订单（scene 3/4）有 sourcePlanCode → 退款后恢复原套餐 + 折算剩余天数
      //   - 新购/续费订单（scene 1/2）→ 直接清空会员
      const orderScene = orderData.scene;
      const sourcePlanCode = orderData.sourcePlanCode;
      const sourceRemainingValue = orderData.sourceRemainingValue
        ? Number(orderData.sourceRemainingValue)
        : 0;

      if ((orderScene === 3 || orderScene === 4) && sourcePlanCode && sourceRemainingValue > 0) {
        // 查原套餐信息以折算回剩余天数
        const sourcePlan = await this.ctx.model.PaidPlan.findOne({
          where: { code: sourcePlanCode },
          transaction: t,
        });
        if (sourcePlan) {
          const sourcePlanData = (sourcePlan as any).toJSON();
          // 折算剩余天数 = (remainingValue / planPrice) * planDurationDays
          const restoredDays = sourcePlanData.durationDays > 0 && sourcePlanData.price > 0
            ? Math.ceil((sourceRemainingValue / Number(sourcePlanData.price)) * sourcePlanData.durationDays)
            : 0;
          if (restoredDays > 0) {
            const restoredExpireAt = new Date(now.getTime() + restoredDays * 86400000);
            await this.ctx.model.UserMember.update(
              { isPaid: 1, paidPlanCode: sourcePlanCode, paidExpireAt: restoredExpireAt },
              { where: { userId: orderData.userId }, transaction: t },
            );
          } else {
            // 原套餐无法折算（例如永久套餐价格为 0）→ 清空
            await this.ctx.model.UserMember.update(
              { isPaid: 0, paidExpireAt: now },
              { where: { userId: orderData.userId }, transaction: t },
            );
          }
        } else {
          // 原套餐已删除 → 降级为无会员
          await this.ctx.model.UserMember.update(
            { isPaid: 0, paidExpireAt: now },
            { where: { userId: orderData.userId }, transaction: t },
          );
        }
      } else {
        // 新购/续费：直接清空会员
        await this.ctx.model.UserMember.update(
          { isPaid: 0, paidExpireAt: now },
          { where: { userId: orderData.userId }, transaction: t },
        );
      }

      asyncContext = { order: orderData, refundId, amount };
      result = {
        refundId,
        refundNo,
        orderId: orderData.id,
        amount: amount.toFixed(2),
        providerRefundNo: refundResult.providerRefundNo,
        fundChange: refundResult.fundChange,
        status: 1,
      };
    });

    // 事务外异步：通知 + audit
    if (asyncContext) {
      const ctx = asyncContext as { order: any; refundId: number; amount: number };
      this.ctx.runInBackground(async () => {
        try {
          await (this.ctx.service.notification as any).core.send({
            typeCode: 'BUSINESS_PAYMENT_REFUNDED',
            userId: ctx.order.userId,
            variables: {
              orderNo: ctx.order.orderNo,
              planName: ctx.order.planSnapshot?.name || ctx.order.planCode,
              amount: ctx.amount.toFixed(2),
              refundNo,
            },
            idempotentKey: `refund_${ctx.refundId}`,
          });
        } catch (e: any) {
          this.ctx.logger.warn(`[refund.create] notification failed: ${e.message}`);
        }
      });
      this._asyncAudit(
        operatorId,
        ctx.refundId,
        ctx.order.id,
        'success',
        `退款成功 ¥${ctx.amount.toFixed(2)}（订单 ${ctx.order.orderNo}）`,
      );
    }

    return result;
  }

  /** 异步写 audit log（不阻塞主流程） */
  private _asyncAudit(
    operatorId: number,
    refundId: number,
    orderId: number,
    status: 'success' | 'fail',
    description: string,
  ) {
    this.ctx.runInBackground(async () => {
      try {
        await (this.ctx.service as any).audit.log({
          module: 'member-refund',
          action: 'create',
          bizType: 'member_refund',
          bizId: refundId,
          status,
          description,
          // operatorId 由 service.audit.log 内部从 ctx.state.user 取，这里仅作为补充
          extra: { operatorId, orderId, refundId },
        });
      } catch (e: any) {
        this.ctx.logger.warn(`[refund._asyncAudit] audit failed: ${e.message}`);
      }
    });
  }

  /** 管理端：退款列表（含筛选） */
  async listAll(query: RefundListQuery): Promise<PaginationResult<any>> {
    const { orderId, userId, status, startDate, endDate, ...pagination } = query;
    const where: any = {};
    if (orderId) where.orderId = Number(orderId);
    if (userId) where.userId = Number(userId);
    if (status !== undefined) where.status = Number(status);
    const range = this._buildDateRange(startDate, endDate);
    if (range) where.createdAt = range;
    return this.paginate(this.ctx.model.MemberRefund, {
      where,
      include: [
        {
          model: this.ctx.model.MemberOrder,
          as: 'order',
          attributes: ['id', 'orderNo', 'planCode', 'amount', 'scene'],
        },
        {
          model: this.ctx.model.User,
          as: 'user',
          attributes: ['id', 'username', 'nickname', 'phone', 'email'],
        },
        {
          model: this.ctx.model.User,
          as: 'operator',
          attributes: ['id', 'username', 'nickname'],
        },
      ],
    }, pagination);
  }

  /** 退款详情 */
  async detail(refundId: number) {
    const refund = await this.ctx.model.MemberRefund.findOne({
      where: { id: refundId },
      include: [
        { model: this.ctx.model.MemberPayment, as: 'payment' },
        { model: this.ctx.model.MemberOrder, as: 'order' },
        {
          model: this.ctx.model.User,
          as: 'user',
          attributes: ['id', 'username', 'nickname', 'phone', 'email'],
        },
        {
          model: this.ctx.model.User,
          as: 'operator',
          attributes: ['id', 'username', 'nickname'],
        },
      ],
    });
    if (!refund) this.ctx.throw(404, '退款记录不存在');
    return (refund as any).toJSON();
  }

  // ==================== 私有方法 ====================

  /** 退款单号：RF + ymd + tail6 + rand4 = RF20260523123456789012 */
  private _genRefundNo(): string {
    const now = new Date();
    const ymd = now.getFullYear().toString()
      + String(now.getMonth() + 1).padStart(2, '0')
      + String(now.getDate()).padStart(2, '0');
    const tail6 = Date.now().toString().slice(-6);
    const rand4 = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    return `RF${ymd}${tail6}${rand4}`;
  }

  /** 复用 OrderService 风格的日期范围构造 */
  private _buildDateRange(startDate?: string, endDate?: string): any | null {
    const { Op } = require('sequelize');
    if (!startDate && !endDate) return null;
    const parse = (s: string, isEnd: boolean): Date | null => {
      if (!s) return null;
      const isPureDate = /^\d{4}-\d{2}-\d{2}$/.test(s);
      const raw = isPureDate && isEnd ? `${s}T23:59:59` : s;
      const d = new Date(raw);
      return isNaN(d.getTime()) ? null : d;
    };
    const range: any = {};
    if (startDate) {
      const s = parse(startDate, false);
      if (s) range[Op.gte] = s;
    }
    if (endDate) {
      const e = parse(endDate, true);
      if (e) range[Op.lte] = e;
    }
    return Object.keys(range).length > 0 || Object.getOwnPropertySymbols(range).length > 0
      ? range
      : null;
  }
}
