/* eslint-disable @typescript-eslint/no-var-requires */
/**
 * 历史用户迁移脚本（积分体系 v2 一次性）
 *  设计依据:
 *    - docs/superpowers/plans/2026-05-26-积分成长体系MVP实施计划-v2-续篇.md §Task 19（FIFO 字段回填 + 批次延期）
 *    - docs/superpowers/specs/2026-05-27-积分成长体系后端优化设计文档.md §6（等级回算）
 *    - docs/superpowers/plans/2026-05-27-积分成长体系后端优化-B业务修复实施计划.md Task B11（dry-run/CSV 报告/分批）
 *
 *  目标（4 步）：
 *    1. 回填 points_logs.type=1 行的 FIFO 字段（points_remaining/status/source_event/growth_multiplier/expireAt）
 *    2. 重算所有用户等级（按 growth_value 与 member_levels.upgrade_growth 阈值匹配）
 *    3. 延长 expire_at < NOW+30 天的批次至少 30 天（防迁移当天大批量过期）
 *    4. 输出迁移报表 + CSV failures
 *
 *  注意：
 *    - 不补发升级礼包（避免老用户意外得分，evaluation §6.4）
 *    - 简化策略：type=1 points 当作 remaining 入 FIFO 队列（精确回算工作量过大，运营可接受）
 *    - 幂等：可重复运行
 *      · Step 1 仅处理 points_remaining=0 的 type=1 行
 *      · Step 2 levelId 与目标一致即跳过
 *      · Step 3 仅处理 expireAt < NOW+30天 的活跃批次
 *
 *  运行（B11 增强）：
 *    cd super-tool-node
 *    npx ts-node scripts/migrate_existing_users_points.ts --dry-run    # 仅扫描计算，不写库
 *    npx ts-node scripts/migrate_existing_users_points.ts --apply      # 正式写库
 *    npx ts-node scripts/migrate_existing_users_points.ts              # 默认 dry-run（防误执行）
 *
 *  生产环境前必须先备份：
 *    mysqldump --single-transaction -u<u> -p <db> user_members points_logs > backup_$(date +%s).sql
 *
 *  历史兼容：旧 NODE_ENV=production/test 入口已废弃，--apply / --dry-run 取代。
 */
import { Application } from 'egg';
import * as fs from 'fs';

const eggMock = require('egg-mock');

const args = process.argv.slice(2);
const APPLY = args.includes('--apply');
const DRY_RUN = !APPLY;
const BATCH_SIZE = 1000;

interface Failure {
  step: 'backfill' | 're-level' | 'extend';
  ref: string;
  reason: string;
}

(async () => {
  const app: Application = await eggMock.app({
    baseDir: process.cwd(),
    framework: 'egg',
  });
  await app.ready();

  const { Op, literal, fn, col } = require('sequelize');

  console.log(`\n========== Migration: existing users points ==========`);
  console.log(`Mode: ${DRY_RUN ? 'DRY-RUN（不写库）' : 'APPLY（正式写库）'}`);
  console.log(`Batch size: ${BATCH_SIZE}\n`);

  const failures: Failure[] = [];

  // ---------------------- 1) 回填 points_logs 的 FIFO 字段（分批） ----------------------
  console.log('--- Step 1) 回填 points_logs 的 FIFO 字段 ---');
  let backfilled = 0;
  let backfillScanned = 0;
  let backfillOffset = 0;

  while (true) {
    const logs: any[] = await app.model.PointsLog.findAll({
      where: { type: 1, pointsRemaining: 0 },
      order: [['user_id', 'ASC'], ['id', 'ASC']],
      limit: BATCH_SIZE,
      offset: backfillOffset,
    });
    if (logs.length === 0) break;
    backfillScanned += logs.length;

    for (const log of logs) {
      try {
        if (!DRY_RUN) {
          await log.update({
            pointsRemaining: log.points > 0 ? log.points : 0,
            status: log.points > 0 ? 1 : 2,
            sourceLevelId: null,
            sourceEvent: log.source,
            growthMultiplier: 1.0,
            expireAt: log.expireAt || new Date(Date.now() + 365 * 86_400_000),
          });
        }
        backfilled++;
      } catch (err: any) {
        failures.push({ step: 'backfill', ref: `logId=${log.id}`, reason: err.message });
        console.error(`[backfill] log id=${log.id} failed: ${err.message}`);
      }
    }

    if (logs.length < BATCH_SIZE) break;
    backfillOffset += BATCH_SIZE;
  }
  console.log(`  扫描 ${backfillScanned} 行，待回填 ${backfilled}（${DRY_RUN ? '未写库' : '已写库'}）`);

  // ---------------------- 2) 重算所有用户等级（分批） ----------------------
  console.log('\n--- Step 2) 重算等级 ---');
  const levels: any[] = await app.model.MemberLevel.findAll({
    where: { status: 1 },
    order: [['level', 'DESC']],
  });

  let upgraded = 0;
  let scanned = 0;
  let skipped = 0;
  let memberOffset = 0;

  while (true) {
    const members: any[] = await app.model.UserMember.findAll({
      attributes: ['userId', 'levelId', 'levelCode', 'growthValue'],
      order: [['user_id', 'ASC']],
      limit: BATCH_SIZE,
      offset: memberOffset,
    });
    if (members.length === 0) break;
    scanned += members.length;

    for (const m of members) {
      const target = levels.find((l: any) => m.growthValue >= l.upgradeGrowth);
      if (!target || target.id === m.levelId) {
        skipped++;
        continue;
      }
      try {
        if (!DRY_RUN) {
          await app.model.UserMember.update(
            { levelId: target.id, levelCode: target.code },
            { where: { userId: m.userId } },
          );
        }
        upgraded++;
      } catch (err: any) {
        failures.push({ step: 're-level', ref: `userId=${m.userId}`, reason: err.message });
        console.error(`[re-level] user=${m.userId} failed: ${err.message}`);
      }
    }

    if (members.length < BATCH_SIZE) break;
    memberOffset += BATCH_SIZE;
  }
  console.log(`  扫描 ${scanned} 用户：${upgraded} 待调级、${skipped} 已正确（${DRY_RUN ? '未写库' : '已写库'}）`);

  // ---------------------- 3) 延长批次有效期至少 30 天 ----------------------
  console.log('\n--- Step 3) 延长批次有效期至少 30 天 ---');
  const minExpire = new Date(Date.now() + 30 * 86_400_000);
  const pad = (n: number) => String(n).padStart(2, '0');
  const minExpireSql =
    `${minExpire.getFullYear()}-${pad(minExpire.getMonth() + 1)}-${pad(minExpire.getDate())} ` +
    `${pad(minExpire.getHours())}:${pad(minExpire.getMinutes())}:${pad(minExpire.getSeconds())}`;

  let extendAffected = 0;
  if (DRY_RUN) {
    extendAffected = await (app.model.PointsLog as any).count({
      where: {
        status: 1,
        pointsRemaining: { [Op.gt]: 0 },
        expireAt: { [Op.lt]: minExpire },
      },
    });
  } else {
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
    extendAffected = affected;
  }
  console.log(`  ${DRY_RUN ? '将延长' : '已延长'} ${extendAffected} 个批次到 ${minExpireSql}`);

  // ---------------------- 4) 迁移快照 + CSV 报表 ----------------------
  console.log('\n--- Step 4) 迁移快照 ---');
  const snap: any = await (app.model.PointsLog as any).findOne({
    attributes: [
      [fn('SUM', col('points_remaining')), 'totalRemaining'],
      [fn('COUNT', col('id')), 'totalBatches'],
    ],
    where: { status: 1 },
    raw: true,
  });
  console.log(
    `  active batches = ${snap?.totalBatches || 0} | totalRemaining = ${snap?.totalRemaining || 0}`,
  );

  // CSV failures 报表
  let reportPath: string | null = null;
  if (failures.length > 0) {
    reportPath = `migration_report_${Date.now()}.csv`;
    const lines = ['step,ref,reason'];
    for (const f of failures) {
      lines.push(`${f.step},${f.ref},${f.reason.replace(/,/g, ';').replace(/\n/g, ' ')}`);
    }
    fs.writeFileSync(reportPath, lines.join('\n'));
  }

  // ---------------------- Summary ----------------------
  console.log('\n========== Summary ==========');
  console.log(`Mode:           ${DRY_RUN ? 'DRY-RUN' : 'APPLY'}`);
  console.log(`Backfilled:     ${backfilled}`);
  console.log(`Re-leveled:     ${upgraded}`);
  console.log(`Extended:       ${extendAffected}`);
  console.log(`Failures:       ${failures.length}${reportPath ? ` (see ${reportPath})` : ''}`);

  if (DRY_RUN) {
    console.log('\n💡 当前为 DRY-RUN：未写入数据库。如确认无误，请加 --apply 重新执行。');
  } else {
    console.log('\n✓ migration done');
  }

  await app.close();
  process.exit(failures.length > 0 ? 1 : 0);
})().catch((err: any) => {
  console.error('migration failed:', err);
  process.exit(1);
});
