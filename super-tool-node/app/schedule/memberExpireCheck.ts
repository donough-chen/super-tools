import { Subscription } from 'egg';

/**
 * 会员到期提醒：每天 09:00 扫描三段：
 *   - 7d 后到期：BUSINESS_MEMBER_EXPIRE_SOON, stage=7d
 *   - 1d 后到期：BUSINESS_MEMBER_EXPIRE_SOON, stage=1d
 *   - 已过期（过去 1d 内）：BUSINESS_MEMBER_EXPIRED + is_paid=0
 *
 * 幂等：member_expire_${userId}_${expireYmd}_${stage} / member_expired_${userId}_${expireYmd}
 * 注意 _scanExpireSoon / _scanExpired 通过 (task as any) 暴露给单测。
 */
export default class MemberExpireCheck extends Subscription {
  static get schedule() {
    return {
      cron: '0 0 9 * * *', // 6 段：秒 分 时 日 月 周
      type: 'worker' as const,
      immediate: false,
      disable: false,
    };
  }

  async subscribe() {
    try {
      await (this as any)._scanExpireSoon(7);
      await (this as any)._scanExpireSoon(1);
      await (this as any)._scanExpired();
    } catch (err) {
      this.ctx.logger.error('[Schedule:MemberExpireCheck] 失败:', err);
    }
  }

  /**
   * 扫描 daysAhead 天后到期的会员，发送 BUSINESS_MEMBER_EXPIRE_SOON。
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private async _scanExpireSoon(daysAhead: number) {
    const { Op } = require('sequelize');
    const start = new Date();
    start.setDate(start.getDate() + daysAhead);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setHours(23, 59, 59, 999);

    const members = await this.ctx.model.UserMember.findAll({
      where: {
        isPaid: 1,
        paidExpireAt: { [Op.between]: [start, end] },
      },
    });

    const stage = `${daysAhead}d`;
    for (const m of members) {
      const data = (m as any).toJSON();
      const expireYmd = new Date(data.paidExpireAt).toISOString().slice(0, 10);
      const idempotentKey = `member_expire_${data.userId}_${expireYmd}_${stage}`;

      let planName = data.paidPlanCode;
      try {
        const plan = await this.ctx.model.PaidPlan.findOne({ where: { code: data.paidPlanCode } });
        if (plan) planName = (plan as any).name;
      } catch { /* ignore */ }

      try {
        await (this.ctx.service.notification as any).core.send({
          typeCode: 'BUSINESS_MEMBER_EXPIRE_SOON',
          userId: data.userId,
          variables: { stage, daysLeft: daysAhead, planName, expireAt: expireYmd },
          idempotentKey,
        });
      } catch (e: any) {
        this.ctx.logger.warn(`[MemberExpireCheck] notify ${data.userId} fail: ${e.message}`);
      }
    }
    this.ctx.logger.info(`[MemberExpireCheck] expire-soon stage=${stage} scanned=${members.length}`);
  }

  /**
   * 扫描过去 1d~now 已过期的付费会员，置 is_paid=0 并通知。
   */
  private async _scanExpired() {
    const { Op } = require('sequelize');
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);
    const now = new Date();

    const members = await this.ctx.model.UserMember.findAll({
      where: {
        isPaid: 1,
        paidExpireAt: { [Op.between]: [yesterday, now] },
      },
    });

    for (const m of members) {
      const data = (m as any).toJSON();
      await (m as any).update({ isPaid: 0 });

      const expireYmd = new Date(data.paidExpireAt).toISOString().slice(0, 10);
      const idempotentKey = `member_expired_${data.userId}_${expireYmd}`;

      let planName = data.paidPlanCode;
      try {
        const plan = await this.ctx.model.PaidPlan.findOne({ where: { code: data.paidPlanCode } });
        if (plan) planName = (plan as any).name;
      } catch { /* ignore */ }

      try {
        await (this.ctx.service.notification as any).core.send({
          typeCode: 'BUSINESS_MEMBER_EXPIRED',
          userId: data.userId,
          variables: { planName, expireAt: expireYmd },
          idempotentKey,
        });
      } catch (e: any) {
        this.ctx.logger.warn(`[MemberExpireCheck] expired-notify ${data.userId} fail: ${e.message}`);
      }
    }
    this.ctx.logger.info(`[MemberExpireCheck] expired scanned=${members.length}`);
  }
}
