import BaseService from './base';
import { localTodayStr } from '../lib/dateUtil';

/**
 * 积分对账服务
 *  设计依据: docs/superpowers/plans/2026-05-26-积分成长体系MVP实施计划-v2.md §Task 12
 *           docs/analysis/积分与成长体系深度评估报告.md §5.5 对账机制
 *           docs/superpowers/plans/2026-05-27-积分成长体系后端优化-A基础设施实施计划.md Task A2
 *
 *  两层对账：
 *    1. 日终全量快照（每日 23:55）：记录每个用户的"实际余额（user_members.points）
 *       vs 理论余额（SUM(points_logs.points)）"，差异落 PointsDailySnapshot.is_anomaly
 *    2. 每小时巡检：抽样最近 1 小时变动的用户（≤100），发现差异落告警
 *
 *  注意：
 *    - 本系统因 user_members.points 是 UNSIGNED，钳到 0 时会与流水累计值产生预期差异；
 *      对账时把"理论值钳到 0"再比较（diff = actual - max(0, theoretical)）
 *    - 日期统一走 lib/dateUtil（强制 Asia/Shanghai）
 */
export default class PointsReconcileService extends BaseService {
  /**
   * 日终全量快照（每日 23:55 触发）
   *   分批 1000 用户，逐个查 SUM(points) 作为理论余额，与 user_members.points 对比
   */
  async takeDailySnapshot(): Promise<{ users: number; anomalies: number }> {
    const { fn, col } = require('sequelize');
    const todayStr = localTodayStr();

    let offset = 0;
    let users = 0;
    let anomalies = 0;
    const BATCH_SIZE = 1000;

    // 防御性循环上限：100 万用户
    let safetyGuard = 1000;
    while (safetyGuard-- > 0) {
      const members: any[] = await this.ctx.model.UserMember.findAll({
        attributes: ['userId', 'points', 'growthValue', 'levelId'],
        order: [['user_id', 'ASC']],
        limit: BATCH_SIZE,
        offset,
      });
      if (members.length === 0) break;

      for (const m of members) {
        // 计算理论值：SUM(points_logs.points)（含正负）
        const sumRow: any = await (this.ctx.model.PointsLog as any).findOne({
          attributes: [[fn('SUM', col('points')), 'total']],
          where: { userId: m.userId },
          raw: true,
        });
        const theoretical = Number(sumRow?.total) || 0;
        // 钳到 0（user_members.points 为 UNSIGNED）
        const theoreticalClamped = Math.max(0, theoretical);
        const diff = m.points - theoreticalClamped;
        const isAnomaly = Math.abs(diff) > 0;
        if (isAnomaly) anomalies++;

        try {
          await (this.ctx.model.PointsDailySnapshot as any).upsert({
            snapshotDate: todayStr,
            userId: m.userId,
            pointsBalance: m.points,
            theoreticalBalance: theoreticalClamped,
            diff,
            growthValue: m.growthValue,
            levelId: m.levelId,
            isAnomaly: isAnomaly ? 1 : 0,
          });
          users++;
        } catch (err: any) {
          this.ctx.logger.warn(`[snapshot] upsert err user=${m.userId}: ${err.message}`);
        }
      }
      offset += BATCH_SIZE;
      if (members.length < BATCH_SIZE) break;
    }

    return { users, anomalies };
  }

  /**
   * 每小时余额巡检
   *   找最近 1 小时有 points_logs 写入的用户（最多 100 个），逐个核算
   *   差异 > 0 落告警 + 写日志
   */
  async hourlyBalanceCheck(): Promise<{ checked: number; anomalies: any[] }> {
    const { Op, fn, col } = require('sequelize');
    const Sequelize = require('sequelize');
    const since = new Date(Date.now() - 60 * 60 * 1000);

    // 用 Sequelize.where + col('created_at') 直接以列名查询，避免 attribute 名问题
    const recent: any[] = await (this.ctx.model.PointsLog as any).findAll({
      attributes: [[fn('DISTINCT', col('user_id')), 'userId']],
      where: Sequelize.where(col('created_at'), { [Op.gte]: since }),
      limit: 100,
      raw: true,
    });

    const anomalies: any[] = [];
    for (const r of recent) {
      const userId = Number(r.userId);
      if (!userId) continue;

      const m: any = await this.ctx.model.UserMember.findOne({ where: { userId } });
      if (!m) continue;

      const sumRow: any = await (this.ctx.model.PointsLog as any).findOne({
        attributes: [[fn('SUM', col('points')), 'total']],
        where: { userId },
        raw: true,
      });
      const theoretical = Math.max(0, Number(sumRow?.total) || 0);
      const diff = m.points - theoretical;
      if (Math.abs(diff) > 0) {
        anomalies.push({ userId, actual: m.points, theoretical, diff });
      }
    }

    if (anomalies.length > 0) {
      this.ctx.logger.error(
        `[reconcile] anomalies=${anomalies.length} sample=${JSON.stringify(anomalies.slice(0, 3))}`,
      );
      // 触发告警（如有 alert 模块）
      try {
        const alertSvc: any = (this.ctx.service as any).alert;
        if (alertSvc) {
          const fn1 = alertSvc.createLog || alertSvc.create || null;
          if (typeof fn1 === 'function') {
            await fn1.call(alertSvc, {
              ruleCode: 'points_balance_anomaly',
              severity: 'warning',
              message: `积分余额异常 ${anomalies.length} 个用户`,
              payload: { anomalies: anomalies.slice(0, 10) },
            });
          }
        }
      } catch (err: any) {
        this.ctx.logger.warn(`[reconcile] alert failed: ${err.message}`);
      }
    }

    return { checked: recent.length, anomalies };
  }

  /** 管理端：查询某日快照（默认按 diff 降序，便于运维查异常） */
  async listSnapshots(query: {
    date?: string;
    onlyAnomaly?: boolean;
    page?: number;
    pageSize?: number;
  }) {
    const date = query.date || localTodayStr();
    const where: any = { snapshotDate: date };
    if (query.onlyAnomaly) where.isAnomaly = 1;
    const page = query.page || 1;
    const pageSize = Math.min(query.pageSize || 50, 200);
    return await this.ctx.model.PointsDailySnapshot.findAndCountAll({
      where,
      order: [['diff', 'DESC']],
      limit: pageSize,
      offset: (page - 1) * pageSize,
    });
  }
}
