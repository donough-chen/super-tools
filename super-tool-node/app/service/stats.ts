import { Service } from 'egg';
import { Op } from 'sequelize';

export type TrendMetric = 'user-register' | 'user-login' | 'feedback-submit' | 'tool-access';
export type Granularity = 'day' | 'week' | 'month';

export interface TrendQuery {
  metric: TrendMetric;
  granularity?: Granularity;
  startTime?: string;
  endTime?: string;
}

export interface ToolUsageQuery {
  startTime?: string;
  endTime?: string;
  limit?: number;
}

export interface UserActiveQuery {
  startTime?: string;
  endTime?: string;
}

export type ExportType = 'tool-usage' | 'user-active' | 'trend';

const VALID_METRICS = new Set<TrendMetric>([
  'user-register', 'user-login', 'feedback-submit', 'tool-access',
]);
const VALID_GRANULARITIES = new Set<Granularity>(['day', 'week', 'month']);
const VALID_EXPORT_TYPES = new Set<ExportType>([
  'tool-usage', 'user-active', 'trend',
]);

export default class StatsService extends Service {
  // ============================================================
  // Public API
  // ============================================================

  /**
   * 大盘总览（8 字段）
   */
  async overview() {
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
    const sevenDaysAgo = new Date(Date.now() - 7 * 86400000);

    const [
      userCount, activeUserCount, todayLoginCount, activeSessionCount,
      toolCount, feedbackCount, pendingFeedbackCount, todayNewUserCount,
    ] = await Promise.all([
      this.ctx.model.User.count(),
      this._countActiveUsers(sevenDaysAgo),
      this.ctx.model.LoginLog.count({
        where: { status: 1, created_at: { [Op.gte]: todayStart } },
      }),
      this.ctx.model.UserSession.count({ where: { isActive: 1 } }),
      this.ctx.model.Tool.count({ where: { status: 1 } }),
      this.ctx.model.Feedback.count(),
      this.ctx.model.Feedback.count({ where: { status: 0 } }),
      this.ctx.model.User.count({
        where: { created_at: { [Op.gte]: todayStart } },
      }),
    ]);

    return {
      userCount, activeUserCount, todayLoginCount, activeSessionCount,
      toolCount, feedbackCount, pendingFeedbackCount, todayNewUserCount,
    };
  }

  /**
   * 工具使用 TOP N（从 api_logs 聚合）
   * - 路径模式 /api/tools/:code/access
   * - SUBSTRING_INDEX 提取 code 段
   * - 名称回填（避免 N+1）
   */
  async getToolUsage(q: ToolUsageQuery) {
    const { startTime, endTime } = this._parseTimeRange(q);
    const limit = Math.min(100, Math.max(1, q.limit || 20));

    const sql = `
      SELECT SUBSTRING_INDEX(SUBSTRING_INDEX(path, '/', 4), '/', -1) AS tool_code,
             COUNT(*) AS count
      FROM api_logs
      WHERE path LIKE '/api/tools/%/access'
        AND created_at BETWEEN :start AND :end
      GROUP BY tool_code
      ORDER BY count DESC
      LIMIT :limit
    `;
    const rows: any[] = (await (this.app as any).model.query(sql, {
      replacements: { start: startTime, end: endTime, limit },
      type: (this.app as any).Sequelize.QueryTypes.SELECT,
    })) as any[];

    // 名称回填
    const codes = rows.map((r: any) => r.tool_code).filter(Boolean);
    const tools = codes.length > 0
      ? await this.ctx.model.Tool.findAll({
          where: { code: codes }, attributes: ['code', 'name'],
        })
      : [];
    const nameMap = new Map((tools as any[]).map(t => [t.code, t.name]));

    return rows.map((r: any) => ({
      toolCode: r.tool_code,
      toolName: nameMap.get(r.tool_code) || '(已删除/未知)',
      count: Number(r.count),
    }));
  }

  /**
   * 用户活跃统计 — DAU / WAU / MAU + 新增用户趋势
   */
  async getUserActive(q: UserActiveQuery) {
    const { startTime, endTime } = this._parseTimeRange(q);
    const now = new Date();
    const dayAgo   = new Date(now.getTime() - 1  * 86400000);
    const weekAgo  = new Date(now.getTime() - 7  * 86400000);
    const monthAgo = new Date(now.getTime() - 30 * 86400000);

    const [dau, wau, mau, newUserPoints] = await Promise.all([
      this._countActiveUsers(dayAgo),
      this._countActiveUsers(weekAgo),
      this._countActiveUsers(monthAgo),
      this._getNewUserTrend(startTime, endTime),
    ]);

    return { dau, wau, mau, newUserTrend: newUserPoints };
  }

  /**
   * 通用趋势 — 4 metric × 3 granularity
   * - 白名单 switch 防 SQL 注入：metric / granularity 都来自固定枚举
   * - DATE_FORMAT 第二参数是字符串常量（来自 _bucketFormat 白名单），可安全拼接
   */
  async getTrend(q: TrendQuery) {
    const metric = q.metric;
    const granularity = q.granularity || 'day';
    const { startTime, endTime } = this._parseTimeRange(q);

    if (!VALID_METRICS.has(metric)) {
      this.ctx.throw(422, `invalid metric: ${metric}`);
    }
    if (!VALID_GRANULARITIES.has(granularity)) {
      this.ctx.throw(422, `invalid granularity: ${granularity}`);
    }

    const fmt = this._bucketFormat(granularity);
    const config = this._trendSqlConfig(metric);

    // fmt / config.* 全部来自硬编码枚举常量；replacements 只放 start/end
    const sql = `
      SELECT DATE_FORMAT(${config.timeColumn}, '${fmt}') AS bucket,
             COUNT(*) AS count
      FROM ${config.table}
      WHERE ${config.timeColumn} BETWEEN :start AND :end
        ${config.extraWhere || ''}
      GROUP BY bucket
      ORDER BY bucket ASC
    `;
    const rows: any[] = (await (this.app as any).model.query(sql, {
      replacements: { start: startTime, end: endTime },
      type: (this.app as any).Sequelize.QueryTypes.SELECT,
    })) as any[];

    return {
      metric, granularity,
      points: rows.map((r: any) => ({
        date: r.bucket, count: Number(r.count),
      })),
    };
  }

  /**
   * CSV 导出（复用 Spec-A1 PassThrough 模板）
   * - tool-usage / user-active / trend 三类
   * - UTF-8 BOM + 自实现 CSV 转义
   */
  async exportCsv(type: ExportType, q: any) {
    const { ctx } = this;
    if (!VALID_EXPORT_TYPES.has(type)) {
      ctx.throw(422, `invalid export type: ${type}`);
    }

    ctx.set('Content-Type', 'text/csv; charset=utf-8');
    ctx.set('Content-Disposition',
      `attachment; filename="stats-${type}-${Date.now()}.csv"`);

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { PassThrough } = require('stream');
    const stream = new PassThrough();
    ctx.body = stream;
    stream.write('\uFEFF');   // UTF-8 BOM

    if (type === 'tool-usage') {
      await this._exportToolUsage(stream, q);
    } else if (type === 'user-active') {
      await this._exportUserActive(stream, q);
    } else {
      await this._exportTrend(stream, q);
    }
    stream.end();
  }

  // ============================================================
  // Private helpers
  // ============================================================

  /** 解析时间范围（默认最近 30 天） */
  protected _parseTimeRange(q: { startTime?: string; endTime?: string }) {
    const now = new Date();
    const defaultStart = new Date(now.getTime() - 30 * 86400000);
    const startTime = q.startTime ? new Date(q.startTime) : defaultStart;
    const endTime = q.endTime ? new Date(q.endTime) : now;
    return { startTime, endTime };
  }

  /** 活跃用户数（去重 user_id，since 之后有过成功登录） */
  protected async _countActiveUsers(sinceDate: Date): Promise<number> {
    const sql = `
      SELECT COUNT(DISTINCT user_id) AS cnt
      FROM login_logs
      WHERE status = 1 AND created_at >= :sinceDate
    `;
    const rows: any[] = (await (this.app as any).model.query(sql, {
      replacements: { sinceDate },
      type: (this.app as any).Sequelize.QueryTypes.SELECT,
    })) as any[];
    return Number(rows[0]?.cnt || 0);
  }

  /** 新增用户趋势（按日 GROUP BY） */
  protected async _getNewUserTrend(start: Date, end: Date) {
    const sql = `
      SELECT DATE_FORMAT(created_at, '%Y-%m-%d') AS bucket,
             COUNT(*) AS count
      FROM users
      WHERE created_at BETWEEN :start AND :end
      GROUP BY bucket
      ORDER BY bucket ASC
    `;
    const rows: any[] = (await (this.app as any).model.query(sql, {
      replacements: { start, end },
      type: (this.app as any).Sequelize.QueryTypes.SELECT,
    })) as any[];
    return rows.map((r: any) => ({ date: r.bucket, count: Number(r.count) }));
  }

  /** granularity → MySQL DATE_FORMAT 模式（白名单 switch） */
  protected _bucketFormat(g: Granularity): string {
    switch (g) {
      case 'day':   return '%Y-%m-%d';
      case 'week':  return '%x-W%v';        // ISO 周（%x 年 + %v 周序号）
      case 'month': return '%Y-%m';
    }
  }

  /** metric → SQL 配置（表名 / 时间列 / 额外 WHERE） */
  protected _trendSqlConfig(metric: TrendMetric) {
    switch (metric) {
      case 'user-register':
        return { table: 'users', timeColumn: 'created_at', extraWhere: '' };
      case 'user-login':
        return { table: 'login_logs', timeColumn: 'created_at',
                 extraWhere: 'AND status = 1' };
      case 'feedback-submit':
        return { table: 'feedbacks', timeColumn: 'created_at',
                 extraWhere: 'AND deleted_at IS NULL' };
      case 'tool-access':
        return { table: 'api_logs', timeColumn: 'created_at',
                 extraWhere: "AND path LIKE '/api/tools/%/access'" };
    }
  }

  protected async _exportToolUsage(stream: any, q: any) {
    stream.write(['工具编码', '工具名称', '使用次数']
      .map(v => this._csvField(v)).join(',') + '\n');
    const data = await this.getToolUsage({ ...q, limit: 10000 });
    for (const row of data) {
      stream.write([row.toolCode, row.toolName, row.count]
        .map(v => this._csvField(v)).join(',') + '\n');
    }
  }

  protected async _exportUserActive(stream: any, q: any) {
    // 多段格式：[总览] + [新增用户趋势]
    const data = await this.getUserActive(q);
    stream.write('指标,值\n');
    stream.write(`DAU,${data.dau}\nWAU,${data.wau}\nMAU,${data.mau}\n\n`);
    stream.write('日期,新增数\n');
    for (const p of data.newUserTrend) {
      stream.write([p.date, p.count]
        .map(v => this._csvField(v)).join(',') + '\n');
    }
  }

  protected async _exportTrend(stream: any, q: any) {
    const data = await this.getTrend(q);
    stream.write(`指标,${this._csvField(data.metric)}\n`);
    stream.write(`粒度,${this._csvField(data.granularity)}\n\n`);
    stream.write('日期,数量\n');
    for (const p of data.points) {
      stream.write([p.date, p.count]
        .map(v => this._csvField(v)).join(',') + '\n');
    }
  }

  /** CSV 字段转义（与 audit.exportCsv 一致） */
  protected _csvField(v: any): string {
    if (v == null) return '';
    const s = String(v);
    if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  }
}
