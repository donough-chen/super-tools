import BaseService from './base';
import { localTodayStr } from '../lib/dateUtil';

/**
 * 积分过期 + 升级延长有效期
 *  设计依据: docs/superpowers/plans/2026-05-26-积分成长体系MVP实施计划-v2.md §Task 10
 *           docs/analysis/积分与成长体系深度评估报告.md §5.4 提醒触达 / §4.4 升级延长
 *           docs/superpowers/plans/2026-05-27-积分成长体系后端优化-A基础设施实施计划.md Task A2
 *
 *  核心方法：
 *    - processExpiredBatches() —— 扫描 expire_at<=NOW 的批次清零（FIFO 状态置 3）
 *    - extendExpireOnUpgrade() —— 升级时把存量批次 expire_at = GREATEST(原值, NOW+新等级有效期)
 *    - sendExpireReminders()  —— T-30 / T-7 / T-0 多渠道提醒（PointsExpiryNotice 唯一索引保幂等）
 *    - getStats()             —— 管理端过期统计（即将过期 + 本月已过期）
 *
 *  日期统一走 lib/dateUtil（强制 Asia/Shanghai，与 server 时区无关）。
 */
export default class PointsExpireService extends BaseService {
  /**
   * 每日定时调用：清零已过期的批次
   *  - 分批扫描（每次 500 条）防大事务
   *  - 单批次单事务（行级锁 + 幂等检查）
   *  - 写 type=3 的过期流水 + 写 PointsExpiryLog 执行记录
   */
  async processExpiredBatches(): Promise<{ processedUsers: number; totalExpired: number }> {
    const { Op } = require('sequelize');
    const now = new Date();
    let totalExpired = 0;
    const processedUserIds = new Set<number>();

    // 分批扫描，最多 100 轮（防止死循环）
    let safetyGuard = 100;
    while (safetyGuard-- > 0) {
      const batches: any[] = await this.ctx.model.PointsLog.findAll({
        where: {
          status: 1,
          pointsRemaining: { [Op.gt]: 0 },
          // 注意：Sequelize 同字段不能同时写多个 Op（互相覆盖）；
          // expireAt <= now 本身已排除 NULL（NULL <= X 为 NULL=false）
          expireAt: { [Op.lte]: now },
        },
        limit: 500,
        order: [['expire_at', 'ASC'], ['id', 'ASC']],
      });
      if (batches.length === 0) break;

      for (const b of batches) {
        const expired = b.pointsRemaining;
        try {
          await (this.ctx.model as any).transaction(async (t: any) => {
            // 幂等：先看是否已有过期记录
            const exist = await this.ctx.model.PointsExpiryLog.findOne({
              where: { sourceLogId: b.id },
              transaction: t,
            });
            if (exist) return;

            // 锁批次 + 锁会员
            await b.reload({ lock: t.LOCK.UPDATE, transaction: t });
            if (b.status !== 1 || b.pointsRemaining <= 0) return;

            const member: any = await this.ctx.model.UserMember.findOne({
              where: { userId: b.userId },
              lock: t.LOCK.UPDATE,
              transaction: t,
            });
            if (!member) return;
            // user_members.points 是 UNSIGNED → 钳到 0
            const newBalance = Math.max(0, member.points - b.pointsRemaining);

            // 1) 批次清零，状态置 3=已过期
            await b.update({ pointsRemaining: 0, status: 3 }, { transaction: t });

            // 2) 会员余额扣减
            await member.update({ points: newBalance }, { transaction: t });

            // 3) 写 type=3 的过期流水（points_logs.balance 是 UNSIGNED → 已钳到 0）
            const expiredLog: any = await this.ctx.model.PointsLog.create(
              {
                userId: b.userId,
                type: 3,
                source: 'points_expire',
                points: -expired,
                balance: newBalance,
                growthDelta: 0,
                bizType: 'expire',
                bizId: String(b.id),
                remark: `积分过期清零（来源批次 #${b.id}）`,
                pointsRemaining: 0,
                status: 3,
                sourceLevelId: member.levelId,
                sourceEvent: 'points_expire',
                growthMultiplier: b.growthMultiplier || 1.0,
              },
              { transaction: t },
            );

            // 4) 写过期执行记录（executedAt 客户端显式传，绕过 Sequelize allowNull 客户端校验）
            await this.ctx.model.PointsExpiryLog.create(
              {
                userId: b.userId,
                sourceLogId: b.id,
                expiredPoints: expired,
                expiredLogId: expiredLog.id,
                executedAt: new Date(),
              },
              { transaction: t },
            );
          });
          totalExpired += expired;
          processedUserIds.add(b.userId);
        } catch (err: any) {
          this.ctx.logger.error(`[expire] batch=${b.id} user=${b.userId} err=${err.message}`);
        }
      }
    }

    // 对每个有积分被清零的用户发"已过期"通知
    for (const uid of processedUserIds) {
      try {
        await (this.ctx.service.notification as any).core.send({
          typeCode: 'BUSINESS_POINTS_EXPIRED',
          userId: uid,
          variables: { date: localTodayStr() },
        });
      } catch { /* ignore */ }
    }
    return { processedUsers: processedUserIds.size, totalExpired };
  }

  /**
   * 升级时延长存量积分有效期：
   *   存量批次 expire_at = GREATEST(原 expire_at, NOW + 新等级有效期天数)
   *
   * 由 MemberService.checkAndUpgrade 在升级事务内调用
   */
  async extendExpireOnUpgrade(
    userId: number,
    newRule: { pointsExpireDays: number },
    transaction?: any,
  ): Promise<number> {
    const { Op, literal } = require('sequelize');
    const newExpireAt = new Date(Date.now() + newRule.pointsExpireDays * 86_400_000);
    // 用本地时区格式化（MySQL DATETIME 默认按本地时区存储，避免 ISOString 的 UTC 偏移）
    const pad = (n: number) => String(n).padStart(2, '0');
    const newExpireSql =
      `${newExpireAt.getFullYear()}-${pad(newExpireAt.getMonth() + 1)}-${pad(newExpireAt.getDate())} ` +
      `${pad(newExpireAt.getHours())}:${pad(newExpireAt.getMinutes())}:${pad(newExpireAt.getSeconds())}`;

    const [updated] = await (this.ctx.model.PointsLog as any).update(
      {
        expireAt: literal(`GREATEST(\`expire_at\`, '${newExpireSql}')`),
      },
      {
        where: {
          userId,
          status: 1,
          pointsRemaining: { [Op.gt]: 0 },
          // expireAt 不为 NULL 的批次才有意义；GREATEST 对 NULL 也会返回 NULL
          // 这里通过 `expireAt: { [Op.ne]: null }` 单独判断（不与其他 Op 同字段）
          expireAt: { [Op.ne]: null },
        },
        transaction,
      },
    );
    return updated || 0;
  }

  /**
   * T-30 / T-7 / T-0 多渠道分时提醒
   *  - PointsExpiryNotice 唯一索引（user_id+notice_stage+expire_date）保证幂等
   *  - 注意：现有 NotificationCoreService 仅支持 in_app/email/sms 三个渠道；
   *         push 暂未实现，先不发；后续 push 渠道接入后再补。
   */
  async sendExpireReminders(): Promise<{ sent: number }> {
    const { Op, fn, col } = require('sequelize');
    type Stage = { days: number; stage: number; channels: ('in_app' | 'email' | 'sms')[] };
    const stages: Stage[] = [
      { days: 30, stage: 1, channels: ['in_app'] },
      { days:  7, stage: 2, channels: ['in_app', 'sms'] },
      { days:  0, stage: 3, channels: ['in_app', 'sms', 'email'] },
    ];

    let sent = 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
      const todayStr = localTodayStr(today);

    for (const stage of stages) {
      const targetDay = new Date(today.getTime() + stage.days * 86_400_000);
      const dayStart = new Date(targetDay); dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(targetDay); dayEnd.setHours(23, 59, 59, 999);
      const expireDateStr = localTodayStr(dayStart);

      // 按用户聚合：当日到期的总积分
      const groups: any[] = await (this.ctx.model.PointsLog as any).findAll({
        attributes: ['userId', [fn('SUM', col('points_remaining')), 'total']],
        where: {
          status: 1,
          pointsRemaining: { [Op.gt]: 0 },
          expireAt: { [Op.between]: [dayStart, dayEnd] },
        },
        group: ['user_id'],
        raw: true,
      });

      for (const g of groups) {
        const total = Number(g.total);
        if (total <= 0) continue;
        const uid = Number(g.userId);

        // 幂等检查
        const exist = await this.ctx.model.PointsExpiryNotice.findOne({
          where: { userId: uid, noticeStage: stage.stage, expireDate: expireDateStr },
        });
        if (exist) continue;

        // 多渠道发送（一次调用，notification 内部会拆分到各渠道）
        try {
          await (this.ctx.service.notification as any).core.send({
            typeCode: 'BUSINESS_POINTS_EXPIRE_REMIND',
            userId: uid,
            channels: stage.channels,
            variables: {
              points: total,
              days: stage.days,
              expireDate: expireDateStr,
            },
          });
        } catch (err: any) {
          this.ctx.logger.warn(`[expire_remind] user=${uid} stage=${stage.stage} err=${err.message}`);
        }

        // 写幂等记录（即使发送失败也写，防止重复发送骚扰用户；失败可通过日志重发）
        try {
          await this.ctx.model.PointsExpiryNotice.create({
            userId: uid,
            noticeDate: todayStr,
            noticeStage: stage.stage,
            expireDate: expireDateStr,
            pointsAmount: total,
            channels: stage.channels,
          });
          sent++;
        } catch (err: any) {
          // 唯一索引冲突说明并发触发，忽略即可
          this.ctx.logger.warn(`[expire_remind] notice insert err=${err.message}`);
        }
      }
    }
    return { sent };
  }

  /** 管理端：过期统计 */
  async getStats(): Promise<{ soonExpirePoints: number; expiredThisMonth: number }> {
    const { Op, fn, col } = require('sequelize');
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    // 即将过期（30 天内）
    const soonRows: any = await (this.ctx.model.PointsLog as any).findOne({
      attributes: [[fn('SUM', col('points_remaining')), 'total']],
      where: {
        status: 1,
        pointsRemaining: { [Op.gt]: 0 },
        expireAt: { [Op.between]: [now, new Date(now.getTime() + 30 * 86_400_000)] },
      },
      raw: true,
    });

    // 本月已过期（用列名 'created_at' 直接查询，避免 attribute 名问题）
    const Sequelize = require('sequelize');
    const monthRows: any = await (this.ctx.model.PointsLog as any).findOne({
      attributes: [[fn('SUM', fn('ABS', col('points'))), 'total']],
      where: Sequelize.and(
        { type: 3 },
        Sequelize.where(col('created_at'), { [Op.gte]: monthStart }),
      ),
      raw: true,
    });

    return {
      soonExpirePoints: Number(soonRows?.total) || 0,
      expiredThisMonth: Number(monthRows?.total) || 0,
    };
  }
}
