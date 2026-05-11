import BaseController from '../base';

/**
 * 审计日志 Controller
 * - list:   GET /api/admin/audit-logs
 * - detail: GET /api/admin/audit-logs/:id
 * - export: GET /api/admin/audit-logs/export
 */
export default class AuditLogController extends BaseController {
  /** 列表查询（7 维过滤 + 分页） */
  async list() {
    const q = this.ctx.query as any;
    const result = await this.service.audit.list({
      page: q.page ? Number(q.page) : undefined,
      pageSize: q.pageSize ? Number(q.pageSize) : undefined,
      startTime: q.startTime,
      endTime: q.endTime,
      userId: q.userId ? Number(q.userId) : undefined,
      module: q.module,
      action: q.action,
      status: q.status !== undefined && q.status !== ''
        ? (Number(q.status) as 0 | 1)
        : undefined,
      keyword: q.keyword,
    });
    this.success(result);
  }

  /** 单条详情（含完整 JSON） */
  async detail() {
    const id = Number(this.ctx.params.id);
    if (!id || Number.isNaN(id)) this.ctx.throw(422, 'invalid id');
    const data = await this.service.audit.detail(id);
    if (!data) this.ctx.throw(404, 'audit log not found');
    this.success(data);
  }

  /** CSV 导出（流式，max ≤ 10000） */
  async exportCsv() {
    const q = this.ctx.query as any;
    const max = Math.min(10000, Number(q.max) || 10000);
    await this.service.audit.exportCsv({
      startTime: q.startTime,
      endTime: q.endTime,
      userId: q.userId ? Number(q.userId) : undefined,
      module: q.module,
      action: q.action,
      status: q.status !== undefined && q.status !== ''
        ? (Number(q.status) as 0 | 1)
        : undefined,
      keyword: q.keyword,
    }, max);
    // 不调 this.success — service 已设置 ctx.body = stream
  }
}
