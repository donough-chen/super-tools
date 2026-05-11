import { Service } from 'egg';
import { Op } from 'sequelize';

export interface AuditLogPayload {
  module: string;
  action: string;
  description?: string;
  bizType?: string;
  bizId?: string | number;
  beforeData?: any;
  afterData?: any;
  status?: 0 | 1;
  failReason?: string;
  /** 极少数情况下覆盖 ctx 注入字段 */
  override?: Record<string, any>;
}

export interface AuditLogQuery {
  page?: number;
  pageSize?: number;
  startTime?: string;
  endTime?: string;
  userId?: number;
  module?: string;
  action?: string;
  status?: 0 | 1;
  keyword?: string;
}

const SENSITIVE_FIELDS = [
  'password', 'newPassword', 'oldPassword', 'confirmPassword',
  'token', 'refreshToken', 'accessToken',
  'clientSecret', 'secret', 'apiKey',
];

/**
 * 审计日志服务
 * - log()       — 写入一条审计（异常吞掉，永不影响主业务）
 * - list()      — 7 维过滤分页查询（不含 before/after JSON）
 * - detail()    — 单条详情（含完整 JSON）
 * - exportCsv() — 流式 CSV 导出（见 §4.4，本 Task 暂用占位，T3 实现）
 */
export default class AuditService extends Service {
  /**
   * 写入一条审计日志
   * - 自动从 ctx 注入：userId/username/platform/ip/userAgent/url/method/cost/trace
   * - 异常吞掉 + logger.warn（永不影响主业务）
   */
  async log(payload: AuditLogPayload): Promise<void> {
    try {
      const { ctx } = this;
      const user = (ctx.state as any).user;
      const startTime = (ctx.state as any).requestStartTime as number | undefined;

      await ctx.model.AuditLog.create({
        traceId: (ctx as any).tracer?.traceId || ctx.get('x-trace-id') || null,
        userId: user?.id ?? null,
        username: user?.username ?? null,
        platform: ctx.get('x-platform') || 'admin',
        module: payload.module,
        action: payload.action,
        description: payload.description ?? null,
        bizType: payload.bizType ?? null,
        bizId: payload.bizId != null ? String(payload.bizId) : null,
        beforeData: payload.beforeData ?? null,
        afterData: payload.afterData ?? null,
        ip: ctx.ip,
        userAgent: ctx.get('user-agent') || null,
        requestUrl: ctx.url,
        requestMethod: ctx.method,
        requestParams: this._sanitizeParams(ctx.request.body),
        responseCode: ctx.status || null,
        costTime: startTime ? Date.now() - startTime : null,
        status: payload.status ?? 1,
        failReason: payload.failReason ?? null,
        ...(payload.override || {}),
      } as any);
    } catch (err) {
      this.ctx.logger.warn('[audit] log failed: %s', (err as Error).message);
    }
  }

  /** 列表查询（7 维过滤 + 分页；列表不含 before/after 减少响应大小） */
  async list(q: AuditLogQuery) {
    const where = this._buildWhere(q);
    const page = Math.max(1, q.page || 1);
    const pageSize = Math.min(100, Math.max(1, q.pageSize || 20));

    const { count, rows } = await this.ctx.model.AuditLog.findAndCountAll({
      where,
      order: [['id', 'DESC']],
      offset: (page - 1) * pageSize,
      limit: pageSize,
      attributes: { exclude: ['beforeData', 'afterData', 'requestParams'] },
    });

    return { total: count, page, pageSize, rows };
  }

  /** 单条详情（含完整 JSON） */
  async detail(id: number) {
    return this.ctx.model.AuditLog.findByPk(id);
  }

  /**
   * 流式 CSV 导出
   * - PassThrough Stream 写入 ctx.body
   * - UTF-8 BOM + 中文表头（Excel 识别中文）
   * - 分批查询（500/批）避免内存峰值
   * - 超过 max 截断 + Header X-Audit-Truncated:true
   */
  async exportCsv(q: AuditLogQuery, max = 10000): Promise<void> {
    const { ctx } = this;
    const where = this._buildWhere(q);

    ctx.set('Content-Type', 'text/csv; charset=utf-8');
    ctx.set('Content-Disposition',
      `attachment; filename="audit-logs-${Date.now()}.csv"`);

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { PassThrough } = require('stream');
    const stream = new PassThrough();
    ctx.body = stream;

    // UTF-8 BOM（Excel 识别中文）
    stream.write('\uFEFF');

    const HEADERS = [
      'ID', '时间', '用户', '模块', '动作', '业务类型', '业务ID',
      '描述', 'IP', 'URL', '方法', '耗时(ms)', '状态', '失败原因',
    ];
    stream.write(HEADERS.join(',') + '\n');

    const BATCH = 500;
    let offset = 0;
    while (offset < max) {
      const limit = Math.min(BATCH, max - offset);
      const rows = await ctx.model.AuditLog.findAll({
        where,
        order: [['id', 'DESC']],
        offset,
        limit,
        attributes: { exclude: ['beforeData', 'afterData', 'requestParams'] },
      });
      if (rows.length === 0) break;
      for (const r of rows) {
        stream.write(this._rowToCsv(r as any) + '\n');
      }
      offset += rows.length;
      if (rows.length < limit) break;  // 数据已全部导出
    }

    // 检查是否还有更多数据未导出 → 标记 truncated
    if (offset >= max) {
      const remain = await ctx.model.AuditLog.count({ where });
      if (remain > max) {
        ctx.set('X-Audit-Truncated', 'true');
        stream.write(
          `\n[NOTE] 已截断，仅导出最新 ${max} 行；如需更多请缩小时间范围\n`,
        );
      }
    }

    stream.end();
  }

  /** 一行 CSV 输出（处理逗号 / 引号 / 换行转义） */
  protected _rowToCsv(r: any): string {
    return [
      r.id,
      r.createdAt ? new Date(r.createdAt).toISOString() : '',
      r.username || r.userId || '',
      r.module, r.action,
      r.bizType || '', r.bizId || '',
      r.description || '',
      r.ip || '', r.requestUrl || '', r.requestMethod || '',
      r.costTime ?? '',
      r.status === 1 ? '成功' : '失败',
      r.failReason || '',
    ].map((v) => this._csvField(v)).join(',');
  }

  /** CSV 字段转义 */
  protected _csvField(v: any): string {
    if (v == null) return '';
    const s = String(v);
    if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  }

  /** 构造列表/导出共用的 where */
  protected _buildWhere(q: AuditLogQuery): any {
    const where: any = {};
    if (q.startTime || q.endTime) {
      where.createdAt = {};
      if (q.startTime) where.createdAt[Op.gte] = new Date(q.startTime);
      if (q.endTime) where.createdAt[Op.lte] = new Date(q.endTime);
    }
    if (q.userId) where.userId = q.userId;
    if (q.module) where.module = q.module;
    if (q.action) where.action = q.action;
    if (q.status !== undefined) where.status = q.status;
    if (q.keyword) where.description = { [Op.like]: `%${q.keyword}%` };
    return where;
  }

  /**
   * 请求参数脱敏（深度遍历）
   * - 敏感字段值替换为 '***'
   * - 仅针对 ctx.request.body 兜底；调用方需自行剔除 beforeData/afterData 中的敏感字段
   */
  protected _sanitizeParams(body: any): any {
    if (!body || typeof body !== 'object') return body;
    let cloned: any;
    try { cloned = JSON.parse(JSON.stringify(body)); }
    catch { return null; }
    const walk = (obj: any) => {
      if (!obj || typeof obj !== 'object') return;
      for (const k of Object.keys(obj)) {
        if (SENSITIVE_FIELDS.includes(k)) {
          obj[k] = '***';
        } else if (typeof obj[k] === 'object') {
          walk(obj[k]);
        }
      }
    };
    walk(cloned);
    return cloned;
  }
}
