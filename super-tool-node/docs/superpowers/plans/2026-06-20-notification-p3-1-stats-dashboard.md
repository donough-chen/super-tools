# P3.1：Stats 数据看板 + Dashboard widget + 异步导出

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement task-by-task.

**Goal:** 在 P1+P2 已沉淀的 `notification_messages / notification_send_logs / notification_tasks` 基础上提供运营观测能力：5 类统计图表 + Dashboard 集成 + Excel 异步导出（BullMQ + 邮件发送）。

**Architecture:**
- **stats service**：5 类聚合查询（overview/trend/byChannel/byType/funnel）；走索引 + 5 分钟内存缓存
- **Stats 大模块**：admin 4 Tab（Overview/Trend/Distribution/Funnel）
- **Dashboard widget**：5 种 widget 注册到现有 `dashboard_widget` registry
- **异步导出**：admin 提交筛选 → `notif.export` 队列 → worker 写 xlsx → 邮件附件发给操作者

**Tech Stack:** Egg.js 3 + Sequelize 原生 SQL + BullMQ + xlsx ^0.18.x + AntD Charts

**前置条件**：tag `p2-done` 存在；项目 `dashboard_widget` 模型与 widget registry 可访问。

**Reference:** 需求文档 V2 §8.2 / §8.5 / §14.2.3

---

## 范围

### ✅ 做

- DB 迁移 023：5 widget 字典 + `notification_export_jobs` 表 + 2 权限码
- `notification-stats.ts`（5 类查询，5min 缓存）
- `notification-export.ts` + `xlsxBuilder.ts` + `notif.export` 队列 + worker
- admin API：5 stats endpoints + 3 export endpoints
- admin UI：Stats 4 Tab + ExportModal + 5 个 Dashboard widget

### ❌ 不做（P3.2/P3.3/P3.4）

- 历史数据归档（P3.2）
- 多 SMTP（P3.3）
- 模板 i18n（P3.3）
- 大任务进度推送（P3.4）

---

## 任务概览

| # | Task | 依赖 |
|---|------|------|
| 1 | 依赖（xlsx）+ config + 错误码 108700-108705 | - |
| 2 | DB 迁移 023 + Model | 1 |
| 3 | notification-stats service + 6 单测 | 2 |
| 4 | xlsxBuilder + 4 单测 | 1 |
| 5 | notif.export 队列 + worker + service + 5 单测 | 4 |
| 6 | admin API（stats 5 + export 3）+ 4 e2e | 3, 5 |
| 7 | Admin UI - Stats 大模块（4 Tab） | 6 |
| 8 | Admin UI - 5 Dashboard widget | 6 |
| 9 | 端到端联调 + 验收 + tag p3-1-done | 1-8 |

---

## Task 1：依赖 + config + 错误码

### 1.1 安装

```bash
cd super-tool-node
npm i xlsx@^0.18.5
```

### 1.2 `config/config.default.ts` 追加

```typescript
config.notification = {
  ...config.notification,
  stats: {
    cacheMs: 5 * 60 * 1000,
    queryTimeoutMs: 10 * 1000,
    maxRangeDays: 90,
  },
  export: {
    queueName: 'notif.export',
    concurrency: 2,
    maxRows: 100_000,
    fileTtlDays: 7,
    storageDir: process.env.EXPORT_STORAGE_DIR || './run/exports',
  },
};
```

### 1.3 `app/constants/errorCodes.ts` 追加

```typescript
NOTIFY_STATS_TIMEOUT:          { code: 108700, message: '统计查询超时' },
NOTIFY_STATS_RANGE_TOO_LARGE:  { code: 108701, message: '统计时间范围超过 90 天' },
NOTIFY_EXPORT_NOT_FOUND:       { code: 108702, message: '导出任务不存在' },
NOTIFY_EXPORT_NOT_READY:       { code: 108703, message: '导出任务尚未完成' },
NOTIFY_EXPORT_EXPIRED:         { code: 108704, message: '导出文件已过期（>7 天）' },
NOTIFY_EXPORT_TOO_LARGE:       { code: 108705, message: '导出条数超限（>10 万）' },
```

`NOTIF_ERR` 短别名同步追加 6 项。

### 1.4 Commit

```bash
git add super-tool-node/package.json super-tool-node/package-lock.json super-tool-node/config/config.default.ts super-tool-node/app/constants/errorCodes.ts
git commit -m "feat(notification): add p3.1 deps (xlsx) + stats/export config + 6 errcodes

Refs: docs/analysis/通知推送系统模块设计需求文档.md (V2 §8.2 §14.2.3)
Plan: docs/superpowers/plans/2026-06-20-notification-p3-1-stats-dashboard.md (Task 1)"
```

---

## Task 2：DB 迁移 023

### 2.1 `database/023_p3_stats_export.sql`

```sql
-- =====================================================
-- 023: P3.1 stats + export
-- =====================================================

-- 1. 导出任务表
CREATE TABLE IF NOT EXISTS `notification_export_jobs` (
  `id`            BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  `name`          VARCHAR(200) NOT NULL,
  `filter`        JSON NOT NULL COMMENT '导出筛选条件 {from,to,typeId,channel,status}',
  `status`        ENUM('pending','running','completed','failed','expired') NOT NULL DEFAULT 'pending',
  `total_rows`    INT UNSIGNED NULL,
  `file_path`     VARCHAR(500) NULL,
  `file_size`     BIGINT UNSIGNED NULL,
  `recipient_email` VARCHAR(200) NULL COMMENT '完成后发送邮件的目标',
  `error_message` TEXT NULL,
  `created_by`    BIGINT UNSIGNED NOT NULL,
  `started_at`    DATETIME NULL,
  `finished_at`   DATETIME NULL,
  `expires_at`    DATETIME NULL COMMENT '文件过期时间（默认 7 天）',
  `created_at`    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY `idx_status_expires` (`status`, `expires_at`),
  KEY `idx_creator` (`created_by`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. dashboard_widget 字典扩展（5 种 widget）
INSERT IGNORE INTO `dashboard_widget` (`code`, `name`, `default_w`, `default_h`, `data_source`, `required_perm`, `created_at`, `updated_at`) VALUES
  ('notif_unread_count',     '我的未读通知',       2, 1, 'notification:unread',           'notification:message:view',  NOW(), NOW()),
  ('notif_send_trend_7d',    '近 7 天发送趋势',    4, 2, 'notification:stats:trend7d',    'notification:stats:view',    NOW(), NOW()),
  ('notif_channel_dist_pie', '渠道分布',           2, 2, 'notification:stats:byChannel',  'notification:stats:view',    NOW(), NOW()),
  ('notif_top_types',        'Top 通知类型',       2, 2, 'notification:stats:byType',     'notification:stats:view',    NOW(), NOW()),
  ('notif_queue_depth',      '队列深度',           2, 1, 'notification:queue:depth',      'notification:stats:view',    NOW(), NOW());

-- 3. 权限
INSERT IGNORE INTO `admin_permissions` (`code`, `name`, `module`, `description`, `created_at`, `updated_at`) VALUES
  ('notification:stats:view',     '查看通知统计', 'notification', '5 类统计图表',    NOW(), NOW()),
  ('notification:export:create',  '创建导出任务', 'notification', '异步导出 xlsx', NOW(), NOW());

INSERT IGNORE INTO `admin_role_permissions` (`role_id`, `permission_id`)
SELECT r.id, p.id
FROM `admin_roles` r, `admin_permissions` p
WHERE r.code IN ('superadmin','opsAdmin')
  AND p.code IN ('notification:stats:view','notification:export:create');
```

### 2.2 `database/023_rollback.sql`

```sql
DELETE FROM `admin_role_permissions`
WHERE permission_id IN (
  SELECT id FROM `admin_permissions`
  WHERE code IN ('notification:stats:view','notification:export:create')
);
DELETE FROM `admin_permissions`
WHERE code IN ('notification:stats:view','notification:export:create');

DELETE FROM `dashboard_widget`
WHERE code IN ('notif_unread_count','notif_send_trend_7d','notif_channel_dist_pie','notif_top_types','notif_queue_depth');

DROP TABLE IF EXISTS `notification_export_jobs`;
```

### 2.3 Model `app/model/notification_export_job.ts`

```typescript
import { Application } from 'egg';

export default (app: Application) => {
  const { BIGINT, STRING, INTEGER, ENUM, JSON: JSONType, DATE, TEXT } = app.Sequelize;
  return app.model.define('NotificationExportJob', {
    id:             { type: BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
    name:           { type: STRING(200), allowNull: false },
    filter:         { type: JSONType, allowNull: false },
    status:         { type: ENUM('pending','running','completed','failed','expired'),
                      allowNull: false, defaultValue: 'pending' },
    totalRows:      { type: INTEGER.UNSIGNED, allowNull: true, field: 'total_rows' },
    filePath:       { type: STRING(500), allowNull: true, field: 'file_path' },
    fileSize:       { type: BIGINT.UNSIGNED, allowNull: true, field: 'file_size' },
    recipientEmail: { type: STRING(200), allowNull: true, field: 'recipient_email' },
    errorMessage:   { type: TEXT, allowNull: true, field: 'error_message' },
    createdBy:      { type: BIGINT.UNSIGNED, allowNull: false, field: 'created_by' },
    startedAt:      { type: DATE, allowNull: true, field: 'started_at' },
    finishedAt:     { type: DATE, allowNull: true, field: 'finished_at' },
    expiresAt:      { type: DATE, allowNull: true, field: 'expires_at' },
    createdAt:      { type: DATE, field: 'created_at' },
    updatedAt:      { type: DATE, field: 'updated_at' },
  }, { tableName: 'notification_export_jobs' });
};
```

### 2.4 验证 & Commit

up + rollback 双向验证通过。

```bash
git add super-tool-node/database/023_p3_stats_export.sql super-tool-node/database/023_rollback.sql super-tool-node/app/model/notification_export_job.ts
git commit -m "feat(notification): db migration 023 (export jobs table + 5 widgets + 2 perms)

Refs: docs/analysis/通知推送系统模块设计需求文档.md (V2 §8.5)
Plan: docs/superpowers/plans/2026-06-20-notification-p3-1-stats-dashboard.md (Task 2)"
```

---

## Task 3：notification-stats service（5 类查询 + 缓存）

### 3.1 测试 `test/notification/service/notification-stats.test.ts`（6 用例）

```typescript
import { app, assert, mock } from 'egg-mock/bootstrap';

describe('service/notification-stats', () => {
  let ctx: any;
  beforeEach(() => { ctx = app.mockContext(); });

  it('overview 返回 6 字段聚合', async () => {
    mock(ctx.model, 'query', async () => [[{
      total: 100, sent: 80, delivered: 70, failed: 5, skipped: 5, read: 30,
    }]]);
    const r = await ctx.service.notificationStats.overview({
      from: new Date('2026-06-01'), to: new Date('2026-06-30'),
    });
    assert.equal(r.total, 100);
    assert.ok(r.readRate <= 1 && r.readRate >= 0);
  });

  it('trend granularity=day 返回数组', async () => {
    mock(ctx.model, 'query', async () => [[
      { ts: '2026-06-01', total: 10, sent: 8, delivered: 7 },
      { ts: '2026-06-02', total: 12, sent: 10, delivered: 9 },
    ]]);
    const r = await ctx.service.notificationStats.trend({
      from: new Date('2026-06-01'), to: new Date('2026-06-30'), granularity: 'day',
    });
    assert.equal(r.length, 2);
  });

  it('byChannel 返回每渠道汇总', async () => {
    mock(ctx.model, 'query', async () => [[
      { channel: 'inApp', total: 50, success: 48, fail: 2 },
      { channel: 'email', total: 30, success: 28, fail: 2 },
    ]]);
    const r = await ctx.service.notificationStats.byChannel({
      from: new Date('2026-06-01'), to: new Date('2026-06-30'),
    });
    assert.equal(r.length, 2);
  });

  it('byType limit=5 返回前 5', async () => {
    mock(ctx.model, 'query', async () => [Array.from({ length: 5 }, (_, i) => ({
      typeKey: `t${i}`, name: `n${i}`, total: 100 - i, sent: 80 - i,
    }))]);
    const r = await ctx.service.notificationStats.byType({
      from: new Date('2026-06-01'), to: new Date('2026-06-30'), limit: 5,
    });
    assert.equal(r.length, 5);
  });

  it('funnel 返回 5 阶段计数', async () => {
    mock(ctx.model, 'query', async () => [[{
      total: 100, queued: 95, sent: 85, delivered: 70, read: 40,
    }]]);
    const r = await ctx.service.notificationStats.funnel({
      from: new Date('2026-06-01'), to: new Date('2026-06-30'),
    });
    assert.equal(r.total, 100);
    assert.equal(r.read, 40);
  });

  it('range > 90d 抛 108701', async () => {
    await assert.rejects(
      ctx.service.notificationStats.overview({
        from: new Date('2025-01-01'), to: new Date('2026-06-30'),
      }),
      /108701/,
    );
  });
});
```

### 3.2 实现 `app/service/notification-stats.ts`

```typescript
import { Service } from 'egg';
import { NOTIF_ERR } from '../constants/errorCodes';

const CACHE = new Map<string, { at: number; data: any }>();

interface Range { from: Date; to: Date; }

export default class NotificationStatsService extends Service {

  async overview(input: Range) {
    this._guardRange(input);
    return this._cached(`ov:${this._key(input)}`, async () => {
      const sql = `SELECT
        COUNT(*) AS total,
        SUM(CASE WHEN status='sent' OR status='delivered' THEN 1 ELSE 0 END) AS sent,
        SUM(CASE WHEN status='delivered' THEN 1 ELSE 0 END) AS delivered,
        SUM(CASE WHEN status='failed' THEN 1 ELSE 0 END) AS failed,
        SUM(CASE WHEN is_read=1 THEN 1 ELSE 0 END) AS \`read\`
      FROM notification_messages WHERE created_at BETWEEN ? AND ?`;
      const skipSql = `SELECT COUNT(*) AS skipped FROM notification_send_logs
        WHERE status='skipped' AND created_at BETWEEN ? AND ?`;
      const [[m]] = await this.ctx.model.query(sql,
        { replacements: [input.from, input.to] }) as any;
      const [[s]] = await this.ctx.model.query(skipSql,
        { replacements: [input.from, input.to] }) as any;
      const total = Number(m.total ?? 0);
      const read = Number(m.read ?? 0);
      return {
        total,
        sent: Number(m.sent ?? 0),
        delivered: Number(m.delivered ?? 0),
        failed: Number(m.failed ?? 0),
        skipped: Number(s.skipped ?? 0),
        readRate: total === 0 ? 0 : Number((read / total).toFixed(4)),
      };
    });
  }

  async trend(input: Range & { granularity: 'day' | 'hour' }) {
    this._guardRange(input);
    return this._cached(`tr:${input.granularity}:${this._key(input)}`, async () => {
      const fmt = input.granularity === 'hour' ? '%Y-%m-%d %H:00:00' : '%Y-%m-%d';
      const sql = `SELECT DATE_FORMAT(created_at, ?) AS ts,
        COUNT(*) AS total,
        SUM(CASE WHEN status IN ('sent','delivered') THEN 1 ELSE 0 END) AS sent,
        SUM(CASE WHEN status='delivered' THEN 1 ELSE 0 END) AS delivered
      FROM notification_messages
      WHERE created_at BETWEEN ? AND ?
      GROUP BY ts ORDER BY ts ASC`;
      const [rows] = await this.ctx.model.query(sql,
        { replacements: [fmt, input.from, input.to] }) as any;
      return rows.map((r: any) => ({
        ts: r.ts, total: Number(r.total),
        sent: Number(r.sent), delivered: Number(r.delivered),
      }));
    });
  }

  async byChannel(input: Range) {
    this._guardRange(input);
    return this._cached(`bc:${this._key(input)}`, async () => {
      const sql = `SELECT channel,
        COUNT(*) AS total,
        SUM(CASE WHEN status IN ('sent','delivered') THEN 1 ELSE 0 END) AS success,
        SUM(CASE WHEN status='failed' THEN 1 ELSE 0 END) AS fail
      FROM notification_messages
      WHERE created_at BETWEEN ? AND ? GROUP BY channel`;
      const [rows] = await this.ctx.model.query(sql,
        { replacements: [input.from, input.to] }) as any;
      return rows.map((r: any) => ({
        channel: r.channel, total: Number(r.total),
        success: Number(r.success), fail: Number(r.fail),
      }));
    });
  }

  async byType(input: Range & { limit: number }) {
    this._guardRange(input);
    return this._cached(`bt:${input.limit}:${this._key(input)}`, async () => {
      const sql = `SELECT t.type_key AS typeKey, t.name,
        COUNT(*) AS total,
        SUM(CASE WHEN m.status IN ('sent','delivered') THEN 1 ELSE 0 END) AS sent
      FROM notification_messages m
      JOIN notification_types t ON t.id = m.type_id
      WHERE m.created_at BETWEEN ? AND ?
      GROUP BY t.id ORDER BY total DESC LIMIT ?`;
      const [rows] = await this.ctx.model.query(sql,
        { replacements: [input.from, input.to, input.limit] }) as any;
      return rows.map((r: any) => ({
        typeKey: r.typeKey, name: r.name,
        total: Number(r.total), sent: Number(r.sent),
      }));
    });
  }

  async funnel(input: Range & { typeKey?: string }) {
    this._guardRange(input);
    return this._cached(`fn:${input.typeKey ?? 'all'}:${this._key(input)}`, async () => {
      const sql = `SELECT
        COUNT(*) AS total,
        SUM(CASE WHEN status IN ('pending','sent','delivered') THEN 1 ELSE 0 END) AS queued,
        SUM(CASE WHEN status IN ('sent','delivered') THEN 1 ELSE 0 END) AS sent,
        SUM(CASE WHEN status='delivered' THEN 1 ELSE 0 END) AS delivered,
        SUM(CASE WHEN is_read=1 THEN 1 ELSE 0 END) AS \`read\`
      FROM notification_messages
      WHERE created_at BETWEEN ? AND ?
      ${input.typeKey ? 'AND type_id = (SELECT id FROM notification_types WHERE type_key = ?)' : ''}`;
      const replacements: any[] = [input.from, input.to];
      if (input.typeKey) replacements.push(input.typeKey);
      const [[r]] = await this.ctx.model.query(sql, { replacements }) as any;
      return {
        total: Number(r.total), queued: Number(r.queued),
        sent: Number(r.sent), delivered: Number(r.delivered),
        read: Number(r.read),
      };
    });
  }

  // -------- 内部 --------

  invalidateCache() { CACHE.clear(); }

  private _guardRange(input: Range) {
    const days = (input.to.getTime() - input.from.getTime()) / 86400_000;
    if (days > this.app.config.notification.stats.maxRangeDays) {
      this.ctx.throwBiz(NOTIF_ERR.STATS_RANGE_TOO_LARGE);
    }
  }

  private _key(input: Range) {
    return `${input.from.toISOString()}_${input.to.toISOString()}`;
  }

  private async _cached<T>(key: string, fn: () => Promise<T>): Promise<T> {
    const ttl = this.app.config.notification.stats.cacheMs;
    const c = CACHE.get(key);
    if (c && Date.now() - c.at < ttl) return c.data;
    const data = await fn();
    CACHE.set(key, { at: Date.now(), data });
    return data;
  }
}
```

### 3.3 验证 & Commit

```bash
npm test -- --testPathPattern=notification-stats
```

预期：6/6 PASS。

```bash
git commit -m "feat(notification): add stats service (5 aggregations + 5min cache + range guard)

Refs: docs/analysis/通知推送系统模块设计需求文档.md (V2 §14.2.3)
Plan: docs/superpowers/plans/2026-06-20-notification-p3-1-stats-dashboard.md (Task 3)"
```

---

## Task 4：xlsxBuilder + 4 单测

### 4.1 实现 `app/lib/xlsxBuilder.ts`

```typescript
import * as XLSX from 'xlsx';
import * as fs from 'fs';
import * as path from 'path';

export interface SheetSpec {
  name: string;
  /** 表头数组（按顺序） */
  headers: string[];
  /** 每行对象，按 headers key 抽取 */
  rows: any[];
  /** 抽列的 key（与 headers 同长） */
  fields: string[];
}

export function buildXlsx(targetPath: string, sheets: SheetSpec[]): { size: number } {
  const wb = XLSX.utils.book_new();
  for (const sheet of sheets) {
    const aoa: any[][] = [sheet.headers];
    for (const row of sheet.rows) {
      aoa.push(sheet.fields.map((k) => formatCell(row[k])));
    }
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    XLSX.utils.book_append_sheet(wb, ws, sheet.name);
  }
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  XLSX.writeFile(wb, targetPath, { bookType: 'xlsx' });
  const stat = fs.statSync(targetPath);
  return { size: stat.size };
}

function formatCell(v: any): any {
  if (v == null) return '';
  if (v instanceof Date) return v.toISOString();
  if (typeof v === 'object') return JSON.stringify(v);
  return v;
}
```

### 4.2 测试 `test/notification/lib/xlsx-builder.test.ts`

```typescript
import { strict as assert } from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { buildXlsx } from '../../../app/lib/xlsxBuilder';

describe('lib/xlsxBuilder', () => {
  let tmp: string;
  beforeEach(() => {
    tmp = path.join(os.tmpdir(), `xlsx_${Date.now()}_${Math.random()}.xlsx`);
  });
  afterEach(() => { try { fs.unlinkSync(tmp); } catch (_) {} });

  it('生成单 sheet 文件', () => {
    const r = buildXlsx(tmp, [{
      name: 'Test', headers: ['ID', 'Name'], fields: ['id', 'name'],
      rows: [{ id: 1, name: 'a' }, { id: 2, name: 'b' }],
    }]);
    assert.ok(fs.existsSync(tmp));
    assert.ok(r.size > 0);
  });

  it('多 sheet 文件', () => {
    buildXlsx(tmp, [
      { name: 'A', headers: ['x'], fields: ['x'], rows: [{ x: 1 }] },
      { name: 'B', headers: ['y'], fields: ['y'], rows: [{ y: 2 }] },
    ]);
    const wb = require('xlsx').readFile(tmp);
    assert.deepEqual(wb.SheetNames, ['A', 'B']);
  });

  it('Date 字段格式化为 ISO', () => {
    buildXlsx(tmp, [{
      name: 'T', headers: ['T'], fields: ['t'],
      rows: [{ t: new Date('2026-06-01T00:00:00Z') }],
    }]);
    const wb = require('xlsx').readFile(tmp);
    const aoa = require('xlsx').utils.sheet_to_json(wb.Sheets.T, { header: 1 });
    assert.equal(aoa[1][0], '2026-06-01T00:00:00.000Z');
  });

  it('null/undefined → 空字符串', () => {
    buildXlsx(tmp, [{
      name: 'T', headers: ['v'], fields: ['v'],
      rows: [{ v: null }, { v: undefined }],
    }]);
    const wb = require('xlsx').readFile(tmp);
    const aoa = require('xlsx').utils.sheet_to_json(wb.Sheets.T, { header: 1, defval: '' });
    assert.equal(aoa[1][0], '');
    assert.equal(aoa[2][0], '');
  });
});
```

### 4.3 Commit

```bash
git commit -m "feat(notification): add xlsxBuilder lib + 4 tests

Refs: docs/analysis/通知推送系统模块设计需求文档.md (V2 §14.2.3)
Plan: docs/superpowers/plans/2026-06-20-notification-p3-1-stats-dashboard.md (Task 4)"
```

---

## Task 5：notif.export 队列 + worker + service

### 5.1 队列：修改 `app/queue/queues.ts` 追加 `getExportQueue`（与 send/task 模式一致，略；参考 P2.2 Task 4）

### 5.2 worker：`app/queue/workers/export.worker.ts`

```typescript
import { Worker, Job } from 'bullmq';
import { Application } from 'egg';

export interface ExportJobData { jobId: number; }

export function startExportWorker(app: Application): Worker {
  const cfg = app.config.notification.queue;
  const exp = app.config.notification.export;
  const worker = new Worker<ExportJobData>(exp.queueName, async (job: Job<ExportJobData>) => {
    const ctx = app.createAnonymousContext();
    ctx.logger.info(`[notif.export] worker job=${job.id} export=${job.data.jobId}`);
    await ctx.service.notificationExport.executeJob(job.data.jobId);
    return { ok: true };
  }, { connection: cfg.connection, concurrency: exp.concurrency });

  worker.on('failed', (job, err) =>
    app.logger.error(`[notif.export] failed: ${err.message}`, err));
  return worker;
}
```

### 5.3 service：`app/service/notification-export.ts`

```typescript
import { Service } from 'egg';
import * as path from 'path';
import * as fs from 'fs';
import { buildXlsx } from '../lib/xlsxBuilder';
import { getExportQueue } from '../queue/queues';
import { NOTIF_ERR } from '../constants/errorCodes';

export interface CreateExportInput {
  name: string;
  filter: { from: Date; to: Date; typeId?: number; channel?: string; status?: string };
  recipientEmail?: string;
  operatorId: number;
}

export default class NotificationExportService extends Service {

  async create(input: CreateExportInput) {
    const { ctx, app } = this;
    // 预估行数
    const count = await this._countRows(input.filter);
    if (count > app.config.notification.export.maxRows) {
      ctx.throwBiz(NOTIF_ERR.EXPORT_TOO_LARGE, `rows=${count}`);
    }
    const expiresAt = new Date(Date.now() + app.config.notification.export.fileTtlDays * 86400_000);
    const job = await ctx.model.NotificationExportJob.create({
      name: input.name,
      filter: input.filter,
      recipientEmail: input.recipientEmail ?? null,
      createdBy: input.operatorId,
      expiresAt,
    });
    const queue = getExportQueue(app);
    await queue.add('export', { jobId: job.id }, { jobId: `exp-${job.id}` });
    return job;
  }

  async executeJob(jobId: number) {
    const { ctx, app } = this;
    const job = await ctx.model.NotificationExportJob.findByPk(jobId);
    if (!job) return;
    await job.update({ status: 'running', startedAt: new Date() });
    try {
      const rows = await this._loadRows(job.filter);
      const filePath = path.join(app.config.notification.export.storageDir, `notif-${job.id}.xlsx`);
      const { size } = buildXlsx(filePath, [{
        name: 'messages',
        headers: ['ID', 'TypeKey', 'UserID', 'Channel', 'Title', 'Status', 'CreatedAt'],
        fields: ['id', 'typeKey', 'userId', 'channel', 'title', 'status', 'createdAt'],
        rows,
      }]);
      await job.update({
        status: 'completed', finishedAt: new Date(),
        totalRows: rows.length, filePath, fileSize: size,
      });
      // 邮件通知
      if (job.recipientEmail) {
        try {
          await ctx.service.mail.sendOnce({
            to: job.recipientEmail,
            subject: `[super-tools] 您的通知导出已完成：${job.name}`,
            html: `<p>导出共 ${rows.length} 行；文件已生成。</p>
                   <p>请在 ${app.config.notification.export.fileTtlDays} 天内下载，过期将自动清理。</p>
                   <p>下载链接（管理后台）：/notification/stats?export=${job.id}</p>`,
          });
        } catch (e: any) {
          ctx.logger.warn(`[notif.export] mail to ${job.recipientEmail} failed: ${e.message}`);
        }
      }
    } catch (e: any) {
      await job.update({
        status: 'failed', finishedAt: new Date(), errorMessage: e.message,
      });
      throw e;
    }
  }

  async getDownloadStream(jobId: number, operatorId: number) {
    const { ctx } = this;
    const job = await ctx.model.NotificationExportJob.findByPk(jobId);
    if (!job) ctx.throwBiz(NOTIF_ERR.EXPORT_NOT_FOUND);
    if (job.status !== 'completed') ctx.throwBiz(NOTIF_ERR.EXPORT_NOT_READY);
    if (job.expiresAt && job.expiresAt < new Date()) ctx.throwBiz(NOTIF_ERR.EXPORT_EXPIRED);
    if (!fs.existsSync(job.filePath)) ctx.throwBiz(NOTIF_ERR.EXPORT_NOT_FOUND, 'file missing');
    return { stream: fs.createReadStream(job.filePath), filename: path.basename(job.filePath), size: job.fileSize };
  }

  // -------- 内部 --------

  private async _countRows(filter: any): Promise<number> {
    const { sql, params } = this._buildSqlForCount(filter);
    const [[r]] = await this.ctx.model.query(sql, { replacements: params }) as any;
    return Number(r.cnt ?? 0);
  }

  private async _loadRows(filter: any): Promise<any[]> {
    const { sql, params } = this._buildSqlForRows(filter);
    const [rows] = await this.ctx.model.query(sql, { replacements: params }) as any;
    return rows;
  }

  private _buildSqlForCount(filter: any) {
    const where: string[] = ['m.created_at BETWEEN ? AND ?'];
    const params: any[] = [filter.from, filter.to];
    if (filter.typeId) { where.push('m.type_id = ?'); params.push(filter.typeId); }
    if (filter.channel) { where.push('m.channel = ?'); params.push(filter.channel); }
    if (filter.status) { where.push('m.status = ?'); params.push(filter.status); }
    return {
      sql: `SELECT COUNT(*) AS cnt FROM notification_messages m WHERE ${where.join(' AND ')}`,
      params,
    };
  }

  private _buildSqlForRows(filter: any) {
    const c = this._buildSqlForCount(filter);
    return {
      sql: `SELECT m.id, t.type_key AS typeKey, m.user_id AS userId, m.channel,
              m.title, m.status, m.created_at AS createdAt
            FROM notification_messages m
            JOIN notification_types t ON t.id = m.type_id
            WHERE ${c.sql.split(' WHERE ')[1]}
            ORDER BY m.id DESC`,
      params: c.params,
    };
  }
}
```

### 5.4 测试 `test/notification/service/notification-export.test.ts`（5 用例）

```typescript
import { app, mock, assert } from 'egg-mock/bootstrap';

describe('service/notification-export', () => {
  let ctx: any;
  beforeEach(async () => {
    ctx = app.mockContext({ adminUser: { id: 1 } });
    await ctx.model.NotificationExportJob.destroy({
      where: { name: { [app.Sequelize.Op.like]: 'TEST_EXP_%' } }, force: true,
    });
  });

  it('create 入队 + 写表', async () => {
    let queued: any = null;
    mock(require('../../../app/queue/queues'), 'getExportQueue', () => ({
      add: async (_n: string, data: any, opts: any) => { queued = { data, opts }; return { id: 'j' }; },
    }));
    mock(ctx.model, 'query', async () => [[{ cnt: 100 }]]);
    const r = await ctx.service.notificationExport.create({
      name: 'TEST_EXP_a',
      filter: { from: new Date('2026-06-01'), to: new Date('2026-06-30') },
      operatorId: 1,
    });
    assert.equal(r.status, 'pending');
    assert.equal(queued.data.jobId, r.id);
    assert.equal(queued.opts.jobId, `exp-${r.id}`);
  });

  it('rows > maxRows 抛 108705', async () => {
    mock(ctx.model, 'query', async () => [[{ cnt: 999_999 }]]);
    await assert.rejects(
      ctx.service.notificationExport.create({
        name: 'TEST_EXP_big',
        filter: { from: new Date('2026-06-01'), to: new Date('2026-06-30') },
        operatorId: 1,
      }),
      /108705/,
    );
  });

  it('executeJob 写文件 + status=completed', async () => {
    mock(ctx.model, 'query', async (sql: string) => {
      if (sql.includes('COUNT(*)')) return [[{ cnt: 2 }]];
      return [[
        { id: 1, typeKey: 't', userId: 1, channel: 'inApp', title: 'a', status: 'sent', createdAt: new Date() },
        { id: 2, typeKey: 't', userId: 2, channel: 'inApp', title: 'b', status: 'sent', createdAt: new Date() },
      ]];
    });
    mock(require('../../../app/lib/xlsxBuilder'), 'buildXlsx', () => ({ size: 1234 }));
    const j = await ctx.model.NotificationExportJob.create({
      name: 'TEST_EXP_run',
      filter: { from: new Date('2026-06-01'), to: new Date('2026-06-30') },
      createdBy: 1,
    });
    await ctx.service.notificationExport.executeJob(j.id);
    await j.reload();
    assert.equal(j.status, 'completed');
    assert.equal(j.totalRows, 2);
    assert.equal(j.fileSize, 1234);
  });

  it('executeJob 抛错 → status=failed', async () => {
    mock(ctx.model, 'query', async () => { throw new Error('db down'); });
    const j = await ctx.model.NotificationExportJob.create({
      name: 'TEST_EXP_fail',
      filter: { from: new Date('2026-06-01'), to: new Date('2026-06-30') },
      createdBy: 1,
    });
    await assert.rejects(ctx.service.notificationExport.executeJob(j.id), /db down/);
    await j.reload();
    assert.equal(j.status, 'failed');
  });

  it('getDownloadStream 未完成 → 108703', async () => {
    const j = await ctx.model.NotificationExportJob.create({
      name: 'TEST_EXP_pending',
      filter: { from: new Date('2026-06-01'), to: new Date('2026-06-30') },
      createdBy: 1, status: 'pending',
    });
    await assert.rejects(
      ctx.service.notificationExport.getDownloadStream(j.id, 1),
      /108703/,
    );
  });
});
```

### 5.5 启动 worker：修改 `app/queue/index.ts` 加入 export worker（与 P2.2 同模式）

### 5.6 Commit

```bash
git commit -m "feat(notification): add export queue + worker + service (xlsx + email delivery)

Refs: docs/analysis/通知推送系统模块设计需求文档.md (V2 §14.2.3)
Plan: docs/superpowers/plans/2026-06-20-notification-p3-1-stats-dashboard.md (Task 5)"
```

---

## Task 6：admin API（stats 5 + export 3）+ 4 e2e

### 6.1 路由

```typescript
// stats
router.get('/api/admin/notification/stats/overview',  adminAuth, adminPerm('notification:stats:view'), controller.admin.notificationStats.overview);
router.get('/api/admin/notification/stats/trend',     adminAuth, adminPerm('notification:stats:view'), controller.admin.notificationStats.trend);
router.get('/api/admin/notification/stats/by-channel',adminAuth, adminPerm('notification:stats:view'), controller.admin.notificationStats.byChannel);
router.get('/api/admin/notification/stats/by-type',   adminAuth, adminPerm('notification:stats:view'), controller.admin.notificationStats.byType);
router.get('/api/admin/notification/stats/funnel',    adminAuth, adminPerm('notification:stats:view'), controller.admin.notificationStats.funnel);
// export
router.post('/api/admin/notification/exports',        adminAuth, adminPerm('notification:export:create'), controller.admin.notificationExport.create);
router.get('/api/admin/notification/exports',         adminAuth, adminPerm('notification:export:create'), controller.admin.notificationExport.list);
router.get('/api/admin/notification/exports/:id/download', adminAuth, adminPerm('notification:export:create'), controller.admin.notificationExport.download);
```

### 6.2 controller 实现（stats 直接转 service；export 同理）

```typescript
// app/controller/admin/notification-stats.ts
import { Controller } from 'egg';
export default class NotificationStatsController extends Controller {
  async overview() {
    const { from, to } = this.ctx.query;
    const r = await this.ctx.service.notificationStats.overview({
      from: new Date(String(from)), to: new Date(String(to)),
    });
    this.ctx.success(r);
  }
  async trend() { /* 类似，多 granularity */ /* ... */ }
  async byChannel() { /* ... */ }
  async byType() { /* ... limit ?? 5 */ }
  async funnel() { /* ... typeKey?: string */ }
}

// app/controller/admin/notification-export.ts
import { Controller } from 'egg';
export default class NotificationExportController extends Controller {
  async create() {
    this.ctx.validate({
      name: { type: 'string', max: 200 },
      filter: { type: 'object' },
      recipientEmail: { type: 'string', required: false },
    }, this.ctx.request.body);
    const filter = this.ctx.request.body.filter;
    const job = await this.ctx.service.notificationExport.create({
      name: this.ctx.request.body.name,
      filter: { ...filter, from: new Date(filter.from), to: new Date(filter.to) },
      recipientEmail: this.ctx.request.body.recipientEmail,
      operatorId: this.ctx.adminUser.id,
    });
    this.ctx.success(job);
  }
  async list() {
    const { rows, count } = await this.ctx.model.NotificationExportJob.findAndCountAll({
      where: { createdBy: this.ctx.adminUser.id },
      order: [['id', 'DESC']],
      offset: ((Number(this.ctx.query.page) || 1) - 1) * 20, limit: 20,
    });
    this.ctx.success({ list: rows, total: count });
  }
  async download() {
    const id = Number(this.ctx.params.id);
    const r = await this.ctx.service.notificationExport.getDownloadStream(id, this.ctx.adminUser.id);
    this.ctx.set('Content-Disposition', `attachment; filename="${r.filename}"`);
    this.ctx.set('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    this.ctx.body = r.stream;
  }
}
```

### 6.3 e2e 测试（4 用例，节略关键断言）

`test/notification/controller/admin/notification-stats.test.ts`：
- GET /stats/overview 返回 6 字段
- GET /stats/trend granularity=day 返回数组
- range 超 90 天 → 108701
- 无权限 → 403

`test/notification/controller/admin/notification-export.test.ts`：
- POST /exports 创建任务 → status=pending；count 接口返回 list 包含
- GET /exports 仅看到自己创建的
- GET /exports/:id/download 未完成 → 108703

### 6.4 Commit

```bash
git commit -m "feat(notification): admin api for stats (5) + export (3) + 4 e2e tests

Refs: docs/analysis/通知推送系统模块设计需求文档.md (V2 §8 §14.2.3)
Plan: docs/superpowers/plans/2026-06-20-notification-p3-1-stats-dashboard.md (Task 6)"
```

---

## Task 7：Admin UI - Stats 大模块（4 Tab）

### 7.1 路由

```typescript
// config/routes/modules/notification.ts 追加
{ path: '/notification/stats',
  name: 'stats',
  component: '@/pages/Notification/Stats',
  access: 'canViewNotificationStats' },
```

`access.ts` 加 `canViewNotificationStats: has('notification:stats:view')`。

### 7.2 services 扩展

```typescript
// src/services/notification.ts 追加
export const NotificationStatsApi = {
  overview:  (p: any) => request('/api/admin/notification/stats/overview', { params: p }),
  trend:     (p: any) => request('/api/admin/notification/stats/trend', { params: p }),
  byChannel: (p: any) => request('/api/admin/notification/stats/by-channel', { params: p }),
  byType:    (p: any) => request('/api/admin/notification/stats/by-type', { params: p }),
  funnel:    (p: any) => request('/api/admin/notification/stats/funnel', { params: p }),
};
export const NotificationExportApi = {
  list:     ()           => request('/api/admin/notification/exports'),
  create:   (data: any)  => request('/api/admin/notification/exports', { method: 'POST', data }),
  download: (id: number) => `/api/admin/notification/exports/${id}/download`,
};
```

### 7.3 页面 `src/pages/Notification/Stats/index.tsx`

```tsx
import React, { useState } from 'react';
import { PageContainer } from '@ant-design/pro-layout';
import { Tabs, DatePicker, Space, Button } from 'antd';
import dayjs from 'dayjs';
import OverviewTab from './OverviewTab';
import TrendTab from './TrendTab';
import DistributionTab from './DistributionTab';
import FunnelTab from './FunnelTab';
import ExportModal from './ExportModal';

export default function StatsPage() {
  const [range, setRange] = useState<[dayjs.Dayjs, dayjs.Dayjs]>([dayjs().subtract(7, 'day'), dayjs()]);
  const [exportOpen, setExportOpen] = useState(false);
  const params = { from: range[0].toISOString(), to: range[1].toISOString() };

  return (
    <PageContainer header={{ title: '通知统计', extra: [
      <DatePicker.RangePicker key="r" value={range as any} onChange={(v) => v && setRange(v as any)} />,
      <Button key="exp" type="primary" onClick={() => setExportOpen(true)}>导出 Excel</Button>,
    ] }}>
      <Tabs defaultActiveKey="ov" items={[
        { key: 'ov', label: '概览', children: <OverviewTab params={params} /> },
        { key: 'tr', label: '趋势', children: <TrendTab params={params} /> },
        { key: 'di', label: '分布', children: <DistributionTab params={params} /> },
        { key: 'fn', label: '漏斗', children: <FunnelTab params={params} /> },
      ]} />
      {exportOpen && <ExportModal range={range} onClose={() => setExportOpen(false)} />}
    </PageContainer>
  );
}
```

### 7.4 4 个 Tab + ExportModal（关键）

`OverviewTab.tsx`：6 个 AntD Statistic 卡片（total/sent/delivered/failed/skipped/readRate）。
`TrendTab.tsx`：`@ant-design/charts` 的 `<Line />` 图表，x=ts，y=total/sent/delivered。
`DistributionTab.tsx`：左饼图（byChannel）+ 右柱图（byType top10）。
`FunnelTab.tsx`：`<Funnel />` 图表，5 阶段 queued/sent/delivered/read。
`ExportModal.tsx`：表单（name/channel/status/recipientEmail）→ 调 `NotificationExportApi.create`，成功 toast"导出任务已提交，完成后将发送邮件"。

### 7.5 Commit

```bash
git commit -m "feat(admin): notification stats 4-tab page + export modal

Refs: docs/analysis/通知推送系统模块设计需求文档.md (V2 §8.2)
Plan: docs/superpowers/plans/2026-06-20-notification-p3-1-stats-dashboard.md (Task 7)"
```

---

## Task 8：Admin UI - 5 Dashboard widget

### 8.1 5 个组件（路径：`src/pages/Dashboard/widgets/`）

每个 widget 是一个 React 函数组件，从 widget registry 接收 `widgetCode`，内部自行调 stats API。

`UnreadCountWidget.tsx`：调 `/api/notifications/unread-count`，显示 Statistic。
`SendTrend7dWidget.tsx`：调 stats.trend(now-7d, now, day)，渲染 mini line chart。
`ChannelDistPieWidget.tsx`：调 stats.byChannel，渲染饼图。
`TopTypesWidget.tsx`：调 stats.byType limit=5，渲染水平柱图。
`QueueDepthWidget.tsx`：每 30s 调一次（定时器）`/api/admin/notification/queue/depth`（暂用 mock；P3.4 真实化），显示数字。

> `QueueDepthWidget` 在 P3.1 用 mock 端点（返回固定 0），P3.4 替换为真实队列查询。

### 8.2 注册到 widget registry

项目应已有 `src/pages/Dashboard/widgetRegistry.ts`：

```typescript
import UnreadCountWidget from './widgets/UnreadCountWidget';
// ...
export const REGISTRY = {
  // ... 已有 widget
  notif_unread_count:     UnreadCountWidget,
  notif_send_trend_7d:    SendTrend7dWidget,
  notif_channel_dist_pie: ChannelDistPieWidget,
  notif_top_types:        TopTypesWidget,
  notif_queue_depth:      QueueDepthWidget,
};
```

### 8.3 Commit

```bash
git commit -m "feat(admin): 5 notification dashboard widgets registered

Refs: docs/analysis/通知推送系统模块设计需求文档.md (V2 §8.5)
Plan: docs/superpowers/plans/2026-06-20-notification-p3-1-stats-dashboard.md (Task 8)"
```

---

## Task 9：端到端联调 + P3.1 验收 + tag

### 9.1 后端验收

- [ ] `npm test` 全过；新增覆盖率 ≥ 75%
- [ ] DB 迁移 023 干净库 up & rollback 各 2 次
- [ ] 6 个错误码 108700-108705 全部用上
- [ ] 审计：export 创建/下载写 audit_logs

### 9.2 业务 e2e（10 场景）

1. Stats 概览：选 7 天范围，6 卡片有合理数字
2. Trend 切换 day/hour 折线刷新
3. byChannel 饼图 3 渠道占比
4. byType top 5 与 messages 表 GROUP BY 一致
5. Funnel 5 阶段数字递减（queued ≥ sent ≥ delivered ≥ read）
6. range > 90d → API 返回 108701
7. 创建导出任务 → 收到邮件附件
8. 列表页看到自己历史导出
9. 下载未完成任务 → 108703
10. 文件 7 天后 expires → 108704

### 9.3 性能 & 韧性

- [ ] Stats 5 类查询单次 ≤ 2s（90 天范围）
- [ ] 第二次相同查询走缓存 ≤ 50ms
- [ ] 10 万行导出 ≤ 60s（worker concurrency=2 不积压）

### 9.4 文档与交接

- [ ] CHANGELOG 加 P3.1 条目
- [ ] PM/QA 提供"统计指标含义文档"
- [ ] 写 `2026-06-20-notification-p3-1-self-review.md`

### 9.5 Commit + tag

```bash
git commit -m "chore(notification): mark p3.1 acceptance done"
git tag p3-1-done
```

---

## 完成检查（整个 P3.1）

- [ ] Task 1-9 全 commit（9 + 1 acceptance + 1 tag）
- [ ] 9.1-9.3 全部勾选
- [ ] self-review 已写
- [ ] 进入 [P3.2 Member 到期 + 数据清理 + alert](./2026-06-27-notification-p3-2-member-schedule-alert.md)
