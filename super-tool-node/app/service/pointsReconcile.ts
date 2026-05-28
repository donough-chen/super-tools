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
 *  注意（A1 / B2 之后已变更）：
 *    - 026 SQL 已 ALTER user_members.points / points_logs.balance 为 SIGNED，允许负值；
 *      对账直接 diff = actual - theoretical，不再钳零（spec §2.7 单一事实源）。
 *    - 退款负余额场景属于真实账本状态而非异常，将在 isAnomaly 判定中通过
 *      |diff| > 0 自然识别（无差异即合规，与符号无关）。
 *    - 日期统一走 lib/dateUtil（强制 Asia/Shanghai）
 *
 *  注意（B6 变更，spec §2.8-#25/#26）：
 *    - hourlyBalanceCheck 抽样从固定 100 改为活跃用户 5%，clamp 到 [100, 1000]。
 *    - 原 alertSvc.createLog/create 兜底为死代码（alert.ts 无此公共入口），已移除；
 *      告警通道延后到 C 阶段单独立项（含 AlertRule 注册 + metricType 扩展）。
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
        // SIGNED 后理论值与实际值都可负，直接对比（B2）
        const diff = m.points - theoretical;
        const isAnomaly = Math.abs(diff) > 0;
        if (isAnomaly) anomalies++;

        try {
          await (this.ctx.model.PointsDailySnapshot as any).upsert({
            snapshotDate: todayStr,
            userId: m.userId,
            pointsBalance: m.points,
            theoreticalBalance: theoretical,
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
   *   抽样最近 1 小时有 points_logs 写入的用户（5% 比例，下限 100，上限 1000），逐个核算
   *   差异 > 0 落告警 + 写日志
   *
   *   B6（spec §2.8-#25）：固定 100 抽样在大用户量下覆盖率不足，改为按活跃用户 5% 抽样。
   *     先 COUNT(DISTINCT user_id) 拿活跃数，再以比例计算 limit，clamp 到 [100, 1000]。
   */
  async hourlyBalanceCheck(): Promise<{ checked: number; anomalies: any[] }> {
    const { Op, fn, col } = require('sequelize');
    const Sequelize = require('sequelize');
    const since = new Date(Date.now() - 60 * 60 * 1000);

    // 1) 先查最近 1h 活跃用户数（DISTINCT user_id）
    const activeRow: any = await (this.ctx.model.PointsLog as any).findOne({
      attributes: [[fn('COUNT', fn('DISTINCT', col('user_id'))), 'cnt']],
      where: Sequelize.where(col('created_at'), { [Op.gte]: since }),
      raw: true,
    });
    const active = Number(activeRow?.cnt) || 0;
    // 5% 抽样，下限 100，上限 1000（B6 §2.8-#25）
    const limit = Math.max(100, Math.min(1000, Math.ceil(active * 0.05)));

    // 2) 取抽样用户列表（DISTINCT user_id，限 limit 个）
    const recent: any[] = await (this.ctx.model.PointsLog as any).findAll({
      attributes: [[fn('DISTINCT', col('user_id')), 'userId']],
      where: Sequelize.where(col('created_at'), { [Op.gte]: since }),
      limit,
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
      const theoretical = Number(sumRow?.total) || 0;
      // SIGNED 后理论值与实际值都可负，直接对比（B2）
      const diff = m.points - theoretical;
      if (Math.abs(diff) > 0) {
        anomalies.push({ userId, actual: m.points, theoretical, diff });
      }
    }

    if (anomalies.length > 0) {
      // B6 §2.8-#26：原 alertSvc.createLog/create 兜底属死代码（alert.ts 实际无此公共入口，
      // fn1 永远为 null）。已移除。告警通道留待 C 阶段单独设计 AlertRule 注册 +
      // checkAllRules metricType 扩展，避免 hardcode ruleId / 污染 AlertRule 表。
      // 当前以 logger.error 作为可观测性入口（运维可经日志聚合订阅 [reconcile] anomalies=*）
      this.ctx.logger.error(
        `[reconcile] anomalies=${anomalies.length} sample=${JSON.stringify(anomalies.slice(0, 3))}`,
      );
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
