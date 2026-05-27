/* eslint-disable @typescript-eslint/no-var-requires */
/**
 * 历史用户迁移脚本（积分体系 v2 一次性）
 *  设计依据: docs/superpowers/plans/2026-05-26-积分成长体系MVP实施计划-v2-续篇.md §Task 19
 *
 *  目标：
 *    1. 回填 points_logs 中 type=1 行的新 FIFO 字段（points_remaining/status/source_event/growth_multiplier/expireAt）
 *    2. 重算所有用户当前等级（按 growth_value 与 member_levels.upgrade_growth 阈值匹配）
 *    3. 把 points_logs 中 expire_at < NOW + 30 天的批次延长到至少剩余 30 天（防迁移当天大批量过期）
 *    4. 输出迁移报表（活跃批次数、总剩余积分）
 *
 *  注意：
 *    - 本脚本不补发升级礼包（避免老用户意外得分，evaluation §6.4 风险点）
 *    - 简化策略：把 type=1 的 points 直接当作 remaining，使历史数据从今天起进入 FIFO 队列
 *      （精确按消耗回算工作量过大，运营上可接受小幅偏差）
 *    - 幂等：可重复运行，仅处理 points_remaining=0 的 type=1 行
 *
 *  运行：
 *    NODE_ENV=test       npx ts-node scripts/migrate_existing_users_points.ts   # dry-run
 *    NODE_ENV=production npx ts-node scripts/migrate_existing_users_points.ts   # 正式执行
 */
import { Application } from 'egg';

const eggMock = require('egg-mock');

(async () => {
  const app: Application = await eggMock.app({
    baseDir: process.cwd(),
    framework: 'egg',
  });
  await app.ready();

  const { Op, literal, fn, col } = require('sequelize');

  // ---------------------- 1) 回填 points_logs 的 FIFO 字段 ----------------------
  console.log('\n--- 1) 回填 points_logs 的 FIFO 字段 ---');
  const logs: any[] = await app.model.PointsLog.findAll({
    where: { type: 1, pointsRemaining: 0 },
    order: [['user_id', 'ASC'], ['id', 'ASC']],
  });
  let backfilled = 0;
  for (const log of logs) {
    try {
      await log.update({
        pointsRemaining: log.points > 0 ? log.points : 0,
        status: log.points > 0 ? 1 : 2,
        sourceLevelId: null,
        sourceEvent: log.source,
        growthMultiplier: 1.0,
        expireAt: log.expireAt || new Date(Date.now() + 365 * 86_400_000),
      });
      backfilled++;
    } catch (err: any) {
      console.error(`[backfill] log id=${log.id} failed: ${err.message}`);
    }
  }
  console.log(`backfilled points_logs rows = ${backfilled}`);

  // ---------------------- 2) 重算所有用户等级 ----------------------
  console.log('\n--- 2) 重算等级 ---');
  // 按 level 降序，取首个满足 growthValue >= upgradeGrowth 的等级
  const levels: any[] = await app.model.MemberLevel.findAll({
    where: { status: 1 },
    order: [['level', 'DESC']],
  });
  const members: any[] = await app.model.UserMember.findAll();
  let upgraded = 0;
  for (const m of members) {
    const target = levels.find((l: any) => m.growthValue >= l.upgradeGrowth);
    if (target && target.id !== m.levelId) {
      try {
        await m.update({ levelId: target.id, levelCode: target.code });
        upgraded++;
      } catch (err: any) {
        console.error(`[re-level] user=${m.userId} failed: ${err.message}`);
      }
    }
  }
  console.log(`re-leveled ${upgraded}/${members.length} users`);

  // ---------------------- 3) 延长批次有效期至少 30 天 ----------------------
  console.log('\n--- 3) 延长批次有效期至少 30 天 ---');
  const minExpire = new Date(Date.now() + 30 * 86_400_000);
  // 用本地时区格式（避免 toISOString 的 UTC 偏移在 MySQL 端解读为本地时间）
  const pad = (n: number) => String(n).padStart(2, '0');
  const minExpireSql =
    `${minExpire.getFullYear()}-${pad(minExpire.getMonth() + 1)}-${pad(minExpire.getDate())} ` +
    `${pad(minExpire.getHours())}:${pad(minExpire.getMinutes())}:${pad(minExpire.getSeconds())}`;
  const [affected]: any = await (app.model.PointsLog as any).update(
    { expireAt: literal(`'${minExpireSql}'`) },
    {
      where: {
        status: 1,
        pointsRemaining: { [Op.gt]: 0 },
        expireAt: { [Op.lt]: minExpire },
      },
    },
  );
  console.log(`extended ${affected} batches`);

  // ---------------------- 4) 输出迁移快照 ----------------------
  console.log('\n--- 4) 迁移快照 ---');
  const snap: any = await (app.model.PointsLog as any).findOne({
    attributes: [
      [fn('SUM', col('points_remaining')), 'totalRemaining'],
      [fn('COUNT', col('id')), 'totalBatches'],
    ],
    where: { status: 1 },
    raw: true,
  });
  console.log(
    `active batches = ${snap?.totalBatches || 0} | totalRemaining = ${snap?.totalRemaining || 0}`,
  );

  console.log('\n✓ migration done');
  await app.close();
  process.exit(0);
})().catch((err: any) => {
  console.error('migration failed:', err);
  process.exit(1);
});
