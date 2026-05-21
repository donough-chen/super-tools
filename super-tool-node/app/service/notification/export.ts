/**
 * @file 数据导出服务
 * @description 管理通知数据的异步导出流程：
 *   1. create(): 校验行数限制 → 创建任务记录 → 入队异步执行
 *   2. executeJob(): 加载数据 → 生成 XLSX 文件 → 更新任务状态 → 可选发送邮件通知
 *   3. getDownloadStream(): 校验状态和过期 → 返回文件流
 *
 *   导出文件默认 7 天过期，由 cleanupExports schedule 自动清理。
 *
 * @module service/notification/export
 */
import { Service } from 'egg';
import * as path from 'path';
import * as fs from 'fs';
import { buildXlsx } from '../../lib/xlsxBuilder';

export interface CreateExportInput {
  name: string;
  filter: { from: Date; to: Date; typeId?: number; channel?: string; status?: string };
  recipientEmail?: string;
  operatorId: number;
}

export default class NotificationExportService extends Service {

  /** 创建导出任务：校验行数限制 → 创建记录 → 入队异步执行（失败则降级同步执行） */
  async create(input: CreateExportInput) {
    const { ctx, app } = this;
    const exportCfg = (app.config as any).notification.export;
    const count = await this._countRows(input.filter);
    if (count > exportCfg.maxRows) ctx.throw(400, `导出条数超限（>${exportCfg.maxRows}）`);
    const expiresAt = new Date(Date.now() + exportCfg.fileTtlDays * 86400_000);
    const job = await ctx.model.NotificationExportJob.create({
      name: input.name, filter: input.filter,
      recipientEmail: input.recipientEmail ?? null, createdBy: input.operatorId, expiresAt,
    });
    try {
      const { getExportQueue } = require('../../queue/queues');
      const queue = getExportQueue(app);
      await queue.add('export', { jobId: (job as any).id }, { jobId: `exp-${(job as any).id}` });
    } catch (e: any) {
      ctx.logger.warn(`[notif.export] queue enqueue failed, running sync: ${e.message}`);
      await this.executeJob((job as any).id);
    }
    return job;
  }

  /** 执行导出任务：加载数据 → 生成 XLSX → 更新状态 → 可选发送邮件通知 */
  async executeJob(jobId: number) {
    const { ctx, app } = this;
    const exportCfg = (app.config as any).notification.export;
    const job = await ctx.model.NotificationExportJob.findByPk(jobId);
    if (!job) return;
    await (job as any).update({ status: 'running', startedAt: new Date() });
    try {
      const filter = (job as any).filter;
      const rows = await this._loadRows(filter);
      const filePath = path.join(exportCfg.storageDir, `notif-${jobId}.xlsx`);
      const { size } = buildXlsx(filePath, [{
        name: 'messages',
        headers: ['ID', 'TypeCode', 'UserID', 'Channel', 'Title', 'Status', 'CreatedAt'],
        fields: ['id', 'typeCode', 'userId', 'channel', 'title', 'status', 'createdAt'],
        rows,
      }]);
      await (job as any).update({ status: 'completed', finishedAt: new Date(), totalRows: rows.length, filePath, fileSize: size });
      if ((job as any).recipientEmail) {
        try {
          await ctx.service.mail.send({
            to: (job as any).recipientEmail,
            subject: `[super-tools] 您的通知导出已完成：${(job as any).name}`,
            html: `<p>导出共 ${rows.length} 行；文件已生成。</p><p>请在 ${exportCfg.fileTtlDays} 天内下载，过期将自动清理。</p>`,
          });
        } catch (e: any) { ctx.logger.warn(`[notif.export] mail failed: ${e.message}`); }
      }
    } catch (e: any) {
      await (job as any).update({ status: 'failed', finishedAt: new Date(), errorMessage: e.message });
      throw e;
    }
  }

  /** 获取导出文件下载流（校验状态、过期、文件存在性） */
  async getDownloadStream(jobId: number) {
    const { ctx } = this;
    const job = await ctx.model.NotificationExportJob.findByPk(jobId);
    if (!job) ctx.throw(404, '导出任务不存在');
    const j = job as any;
    if (j.status !== 'completed') ctx.throw(400, '导出任务尚未完成');
    if (j.expiresAt && new Date(j.expiresAt) < new Date()) ctx.throw(410, '导出文件已过期（>7 天）');
    if (!j.filePath || !fs.existsSync(j.filePath)) ctx.throw(404, '导出文件不存在');
    return { stream: fs.createReadStream(j.filePath), filename: path.basename(j.filePath), size: j.fileSize };
  }

  async list(operatorId: number, page = 1, pageSize = 20) {
    const { rows, count } = await this.ctx.model.NotificationExportJob.findAndCountAll({
      where: { created_by: operatorId } as any,
      order: [['id', 'DESC']], offset: (page - 1) * pageSize, limit: pageSize,
    });
    return { list: rows, total: count };
  }

  /** 统计筛选条件下的消息总数（用于导出前校验行数限制） */
  private async _countRows(filter: any): Promise<number> {
    const { where, params } = this._buildWhere(filter);
    const sql = `SELECT COUNT(*) AS cnt FROM notification_messages m WHERE ${where}`;
    const [[r]] = await this.ctx.model.query(sql, { replacements: params }) as any;
    return Number(r.cnt ?? 0);
  }

  /** 加载筛选条件下的消息数据（用于导出） */
  private async _loadRows(filter: any): Promise<any[]> {
    const { where, params } = this._buildWhere(filter);
    const sql = `SELECT m.id, t.code AS typeCode, m.user_id AS userId, m.channel, m.title, m.status, m.created_at AS createdAt
                FROM notification_messages m LEFT JOIN notification_types t ON t.id = m.type_id WHERE ${where} ORDER BY m.id DESC`;
    const [rows] = await this.ctx.model.query(sql, { replacements: params }) as any;
    return rows;
  }

  /** 构建 SQL WHERE 子句和参数（支持时间范围/类型/渠道/状态筛选） */
  private _buildWhere(filter: any) {
    const clauses: string[] = ['m.created_at BETWEEN ? AND ?'];
    const params: any[] = [filter.from, filter.to];
    if (filter.typeId) { clauses.push('m.type_id = ?'); params.push(filter.typeId); }
    if (filter.channel) { clauses.push('m.channel = ?'); params.push(filter.channel); }
    if (filter.status) { clauses.push('m.status = ?'); params.push(filter.status); }
    return { where: clauses.join(' AND '), params };
  }
}
