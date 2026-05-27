import BaseService from './base';
import { localTodayStr, prevDayStr } from '../lib/dateUtil';

/**
 * 签到服务
 *  设计依据: docs/superpowers/plans/2026-05-26-积分成长体系MVP实施计划-v2.md §Task 6
 *           docs/analysis/积分与成长体系深度评估报告.md §3 行为矩阵 / §4.2 等级签到底分
 *           docs/superpowers/plans/2026-05-27-积分成长体系后端优化-A基础设施实施计划.md Task A2
 *
 *  规则：
 *    1. 每日 1 次（DB 唯一索引 user_signs.uk_user_date 兜底）
 *    2. 基础积分按等级：free=1 / silver=2 / gold=3 / diamond=5 / black=10
 *    3. 连续天数：last_sign_date === 昨天 → streak+1；否则归零（断签归零策略 / 用户决策 A + 未来加 C）
 *    4. 里程碑奖励通过 sign_streak 事件由 TaskService 处理（progress_type=4 覆盖式）
 *    5. 签到积分不叠加等级倍率（仅消费类积分才叠加）
 *    6. 日期统一走 lib/dateUtil（强制 Asia/Shanghai，与 server 时区无关）
 */
export default class SignService extends BaseService {
  /** 每日签到 */
  async dailySign(userId: number) {
    const today = localTodayStr();
    const yesterday = prevDayStr(today);

    return await (this.ctx.model as any).transaction(async (t: any) => {
      const member: any = await this.ctx.model.UserMember.findOne({
        where: { userId },
        lock: t.LOCK.UPDATE,
        transaction: t,
      });
      if (!member) this.ctx.throw(404, '用户会员记录不存在');

      // DB 唯一索引兜底；先查再插，给出友好错误
      const existing: any = await this.ctx.model.UserSign.findOne({
        where: { userId, signDate: today },
        transaction: t,
      });
      if (existing) this.ctx.throw(400, '今日已签到');

      // 计算 streak（断签归零）
      const lastDate = member.lastSignDate
        ? (typeof member.lastSignDate === 'string'
          ? member.lastSignDate
          : new Date(member.lastSignDate).toISOString().slice(0, 10))
        : null;
      const newStreak = (lastDate === yesterday) ? (member.signStreak + 1) : 1;

      // 计算基础积分（按等级）
      const rule = await this.ctx.service.pointsRule.getLevelRule(member.levelId);
      const points = this.ctx.service.pointsRule.calcSignBasePoints(rule);

      // 写签到记录
      await this.ctx.model.UserSign.create(
        {
          userId,
          signDate: today,
          streak: newStreak,
          pointsEarned: points,
          growthEarned: 0,
          levelId: member.levelId,
        },
        { transaction: t },
      );

      // 更新会员签到字段
      await member.update(
        {
          signStreak: newStreak,
          lastSignDate: today,
          totalSignDays: member.totalSignDays + 1,
        },
        { transaction: t },
      );

      // 发积分（不叠加倍率，签到不算消费场景）
      await this.ctx.service.member.addPoints({
        userId,
        points,
        growthDelta: 0,
        source: 'daily_sign',
        event: 'sign',
        remark: `每日签到（连续 ${newStreak} 天）`,
        applyMultiplier: false,
        transaction: t,
      });

      // 触发领域事件（T7 完成后任务系统监听 sign_streak 派发里程碑奖励）
      try {
        await (this.ctx.service as any).event.emit('sign', { userId, streak: newStreak });
        await (this.ctx.service as any).event.emit('sign_streak', { userId, streak: newStreak });
      } catch (e: any) {
        this.ctx.logger.warn(`[sign] event emit failed: ${e.message}`);
      }

      return { points, streak: newStreak, signDate: today };
    });
  }

  /**
   * 签到状态（当月日历）
   * @param yearMonth 'YYYY-MM' 不传则取当前月
   */
  async getSignStatus(userId: number, yearMonth?: string) {
    const ym = yearMonth || localTodayStr().slice(0, 7);
    const start = `${ym}-01`;
    const endDate = new Date(Date.parse(start));
    endDate.setMonth(endDate.getMonth() + 1);
    const ey = endDate.getFullYear();
    const em = String(endDate.getMonth() + 1).padStart(2, '0');
    const ed = String(endDate.getDate()).padStart(2, '0');
    const endStr = `${ey}-${em}-${ed}`;

    const { Op } = require('sequelize');
    const records: any[] = await this.ctx.model.UserSign.findAll({
      where: { userId, signDate: { [Op.gte]: start, [Op.lt]: endStr } },
      order: [['sign_date', 'ASC']],
    });
    const member: any = await this.ctx.model.UserMember.findOne({ where: { userId } });

    const today = localTodayStr();
    return {
      yearMonth: ym,
      signedDates: records.map(r => (typeof r.signDate === 'string' ? r.signDate : new Date(r.signDate).toISOString().slice(0, 10))),
      currentStreak: member?.signStreak || 0,
      totalSignDays: member?.totalSignDays || 0,
      todaySigned: records.some(r => {
        const d = typeof r.signDate === 'string' ? r.signDate : new Date(r.signDate).toISOString().slice(0, 10);
        return d === today;
      }),
    };
  }
}
