import BaseService, { PaginationResult } from './base';
import { calcSwitchPlan, PlanInfo } from '../lib/payment/priceCalculator';

interface CreateOrderInput {
  userId: number;
  planCode: string;
  remark?: string;
}

export interface OrderListQuery {
  page?: number;
  pageSize?: number;
  userId?: number;
  status?: number;
  startDate?: string;
  endDate?: string;
}

export default class OrderService extends BaseService {
  /**
   * 创建订单（C 端入口）— Phase 2 重构
   *
   * 路由 4 个场景：
   *   - scene=1 新购：未付费/已过期 → amount=newPlan.price，需要支付
   *   - scene=2 续费：付费同套餐 → amount=newPlan.price，需要支付
   *   - scene=3 升级：跨套餐 newPrice > remainingValue → amount=差价，需要支付
   *   - scene=4 降级：跨套餐 newPrice <= remainingValue → amount=0，立即开通会员
   *
   * 校验：
   *   1. newPlan 存在且 status=1
   *   2. 当前用户存在未支付订单 → 抛 400（仅 amount > 0 时校验）
   *   3. 永久会员 + 跨套餐 → calcSwitchPlan 抛错（自动捕获为 400）
   */
  async create(input: CreateOrderInput) {
    const { userId, planCode, remark } = input;

    // 1. 取 newPlan
    const newPlan = await this.ctx.model.PaidPlan.findOne({
      where: { code: planCode, status: 1 },
    });
    if (!newPlan) this.ctx.throw(404, '套餐不存在或已下架');
    const newPlanData = (newPlan as any).toJSON();
    const newPlanInfo: PlanInfo = {
      code: newPlanData.code,
      price: Number(newPlanData.price),
      durationDays: newPlanData.durationDays,
    };

    // 2. 取 currentMember + currentPlan
    const member = await this.ctx.model.UserMember.findOne({ where: { userId } });
    const memberData = member ? (member as any).toJSON() : { paidPlanCode: null, paidExpireAt: null };

    let currentPlanInfo: PlanInfo | undefined;
    if (memberData.paidPlanCode &&
      memberData.paidExpireAt &&
      new Date(memberData.paidExpireAt) > new Date() &&
      memberData.paidPlanCode !== planCode
    ) {
      // 跨套餐才需要 currentPlan（同套餐续费用不上）
      const cp = await this.ctx.model.PaidPlan.findOne({
        where: { code: memberData.paidPlanCode },
      });
      if (cp) {
        const d = (cp as any).toJSON();
        currentPlanInfo = {
          code: d.code,
          price: Number(d.price),
          durationDays: d.durationDays,
        };
      }
    }

    // 3. 计算
    let calc;
    try {
      calc = calcSwitchPlan({
        currentMember: {
          paidPlanCode: memberData.paidPlanCode,
          paidExpireAt: memberData.paidExpireAt,
        },
        currentPlan: currentPlanInfo,
        newPlan: newPlanInfo,
      });
    } catch (e: any) {
      this.ctx.throw(400, e.message || '套餐切换失败');
    }

    // 4. 防重复未支付订单（仅 amount > 0 的订单需校验）
    if (calc.amount > 0) {
      const pending = await this.ctx.model.MemberOrder.findOne({
        where: { userId, status: 0 },
      });
      if (pending) this.ctx.throw(400, `您有未完成订单 ${(pending as any).orderNo}，请先处理`);
    }

    // 5. 创建订单
    const orderNo = this._genOrderNo();
    const expireMinutes = await this._getConfig('order_expire_minutes', 30);
    const orderExpireAt = new Date(Date.now() + expireMinutes * 60 * 1000);

    const isCrossPlan = calc.scene === 3 || calc.scene === 4;
    const order = await this.ctx.model.MemberOrder.create({
      orderNo,
      userId,
      planId: newPlanData.id,
      planCode: newPlanData.code,
      planSnapshot: newPlanData,
      amount: calc.amount,
      // scene=4 降级 amount=0，立即标记已支付
      status: calc.scene === 4 ? 1 : 0,
      scene: calc.scene,
      sourcePlanCode: isCrossPlan ? memberData.paidPlanCode : null,
      sourceRemainingValue: isCrossPlan ? calc.remainingValue : null,
      paidAt: calc.scene === 4 ? new Date() : null,
      expireAt: orderExpireAt,
      remark,
    });

    // 6. scene=4 立即开通（无需支付）
    if (calc.scene === 4) {
      await this.service.member.activatePaidPlan(userId, planCode, {
        orderId: (order as any).id,
        mode: 'downgrade',
        newExpireAt: calc.newExpireAt,
      });
    }

    return {
      orderId: (order as any).id,
      orderNo,
      amount: calc.amount.toFixed(2),
      planName: newPlanData.name,
      expireAt: orderExpireAt,
      scene: calc.scene,
      reason: calc.reason,
      needPayment: calc.amount > 0,
      remainingValue: calc.remainingValue,
    };
  }

  /**
   * 预览订单（dryRun）— Phase 2 新增
   *
   * 给 H5 前端在用户点击套餐后展示"差价 / 折算 / 升降级"信息，避免直接下单。
   * 不创建订单、不写库。
   */
  async preview(input: { userId: number; planCode: string }) {
    const { userId, planCode } = input;

    const newPlan = await this.ctx.model.PaidPlan.findOne({
      where: { code: planCode, status: 1 },
    });
    if (!newPlan) this.ctx.throw(404, '套餐不存在或已下架');
    const newPlanData = (newPlan as any).toJSON();
    const newPlanInfo: PlanInfo = {
      code: newPlanData.code,
      price: Number(newPlanData.price),
      durationDays: newPlanData.durationDays,
    };

    const member = await this.ctx.model.UserMember.findOne({ where: { userId } });
    const memberData = member ? (member as any).toJSON() : { paidPlanCode: null, paidExpireAt: null };

    let currentPlanInfo: PlanInfo | undefined;
    let currentPlanName: string | undefined;
    if (memberData.paidPlanCode &&
      memberData.paidExpireAt &&
      new Date(memberData.paidExpireAt) > new Date() &&
      memberData.paidPlanCode !== planCode
    ) {
      const cp = await this.ctx.model.PaidPlan.findOne({
        where: { code: memberData.paidPlanCode },
      });
      if (cp) {
        const d = (cp as any).toJSON();
        currentPlanInfo = {
          code: d.code,
          price: Number(d.price),
          durationDays: d.durationDays,
        };
        currentPlanName = d.name;
      }
    }

    try {
      const calc = calcSwitchPlan({
        currentMember: {
          paidPlanCode: memberData.paidPlanCode,
          paidExpireAt: memberData.paidExpireAt,
        },
        currentPlan: currentPlanInfo,
        newPlan: newPlanInfo,
      });
      return {
        scene: calc.scene,
        amount: calc.amount.toFixed(2),
        remainingDays: calc.remainingDays,
        remainingValue: calc.remainingValue.toFixed(2),
        newExpireAt: calc.newExpireAt.toISOString(),
        reason: calc.reason,
        needPayment: calc.amount > 0,
        currentPlanName,
        newPlanName: newPlanData.name,
      };
    } catch (e: any) {
      this.ctx.throw(400, e.message || '套餐切换失败');
    }
  }

  /** 取消订单（仅 status=0 可取消） */
  async cancel(orderId: number, userId: number) {
    const order = await this.ctx.model.MemberOrder.findOne({
      where: { id: orderId, userId },
    });
    if (!order) this.ctx.throw(404, '订单不存在');
    if ((order as any).status !== 0) this.ctx.throw(400, '订单状态不允许取消');

    await (order as any).update({ status: 2, cancelledAt: new Date() });
    return { orderId, status: 2 };
  }

  /** 订单详情（含 payments 流水 + refunds 退款记录） */
  async detail(orderId: number, userId?: number) {
    const where: any = { id: orderId };
    if (userId) where.userId = userId;
    const order = await this.ctx.model.MemberOrder.findOne({
      where,
      include: [
        { model: this.ctx.model.MemberPayment, as: 'payments' },
        { model: this.ctx.model.MemberRefund, as: 'refunds' },
      ],
    });
    if (!order) this.ctx.throw(404, '订单不存在');
    return (order as any).toJSON();
  }

  /** 用户订单列表 */
  async listByUser(userId: number, query: OrderListQuery): Promise<PaginationResult<any>> {
    const { status, ...pagination } = query;
    const where: any = { userId };
    if (status !== undefined) where.status = Number(status);
    return this.paginate(this.ctx.model.MemberOrder, { where }, pagination);
  }

  /** 管理端：全局订单列表 */
  async listAll(query: OrderListQuery): Promise<PaginationResult<any>> {
    const { userId, status, startDate, endDate, ...pagination } = query;
    const where: any = {};
    if (userId) where.userId = Number(userId);
    if (status !== undefined) where.status = Number(status);
    const range = this._buildDateRange(startDate, endDate);
    if (range) where.createdAt = range;
    return this.paginate(this.ctx.model.MemberOrder, {
      where,
      include: [{
        model: this.ctx.model.User,
        as: 'user',
        attributes: ['id', 'username', 'nickname', 'phone', 'email'],
      }],
    }, pagination);
  }

  /** 管理端：订单统计 */
  async stats(query: { startDate?: string; endDate?: string }) {
    const where: any = {};
    const range = this._buildDateRange(query.startDate, query.endDate);
    if (range) where.createdAt = range;

    const totalOrders = await this.ctx.model.MemberOrder.count({ where });
    const paidOrders = await this.ctx.model.MemberOrder.count({ where: { ...where, status: 1 } });
    const totalRevenue = await this.ctx.model.MemberOrder.sum('amount', {
      where: { ...where, status: 1 },
    }) || 0;

    return {
      totalOrders,
      paidOrders,
      payRate: totalOrders > 0 ? Number((paidOrders / totalOrders).toFixed(4)) : 0,
      totalRevenue: Number(totalRevenue),
    };
  }

  /**
   * 构造 createdAt 的范围条件：
   * - 兼容三种入参：纯日期 `2026-05-21`、本地 datetime、ISO `...Z`
   * - 纯日期补 23:59:59 作为 endDate 上界（含当日全部）
   * - 已含时分秒的 ISO 字符串：直接 new Date 解析
   * - 任一字符串解析失败时返回 null（避免 Invalid Date 写入 where 导致条件失效或异常）
   */
  private _buildDateRange(startDate?: string, endDate?: string): any | null {
    const { Op } = require('sequelize');
    if (!startDate && !endDate) return null;
    const parse = (s: string, isEnd: boolean): Date | null => {
      if (!s) return null;
      // 纯日期形如 2026-05-21（无时分秒），endDate 补当日 23:59:59
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

  /** 调度器：扫描过期订单 */
  async cleanExpired(): Promise<number> {
    const { Op } = require('sequelize');
    const [affected] = await this.ctx.model.MemberOrder.update(
      { status: 3 },
      { where: { status: 0, expireAt: { [Op.lt]: new Date() } } },
    );
    return affected;
  }

  // ==================== 私有方法 ====================

  private _genOrderNo(): string {
    const now = new Date();
    const ymd = now.getFullYear().toString()
      + String(now.getMonth() + 1).padStart(2, '0')
      + String(now.getDate()).padStart(2, '0');
    const rand = Math.floor(Math.random() * 1e6).toString().padStart(6, '0');
    return `MO${ymd}${Date.now().toString().slice(-6)}${rand.slice(0, 4)}`;
  }

  private async _getConfig(key: string, defaultVal: number): Promise<number> {
    const SystemConfig = (this.ctx.model as any).SystemConfig;
    if (!SystemConfig) return defaultVal;
    const row = await SystemConfig.findOne({ where: { group: 'payment', key } });
    if (!row) return defaultVal;
    const v = Number((row as any).value);
    return isNaN(v) ? defaultVal : v;
  }
}
