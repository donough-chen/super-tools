/**
 * @file 数据导出 Worker
 * @description BullMQ Worker，消费 notif.export 队列中的导出任务。
 *   每个 job 包含 jobId，Worker 调用 export service 的 executeJob 方法
 *   执行数据查询、XLSX 生成和可选的邮件通知。
 *
 *   并发度通过 config.notification.export.concurrency 配置。
 *
 * @module queue/workers/export.worker
 */
import { Worker, Job } from 'bullmq';
import { Application } from 'egg';

export interface ExportJobData { jobId: number; }

export function startExportWorker(app: Application): Worker {
  const cfg = (app.config as any).notification.queue;
  const exp = (app.config as any).notification.export;
  const connection = {
    host: process.env.REDIS_HOST || '127.0.0.1',
    port: Number(process.env.REDIS_PORT) || 6379,
    password: process.env.REDIS_PASS || '123456',
  };
  const worker = new Worker<ExportJobData>(exp.queueName, async (job: Job<ExportJobData>) => {
    const ctx = app.createAnonymousContext();
    ctx.logger.info(`[notif.export] worker job=${job.id} export=${job.data.jobId}`);
    await (ctx.service.notification as any).export.executeJob(job.data.jobId);
    return { ok: true };
  }, { connection, concurrency: exp.concurrency });

  worker.on('failed', (job, err) =>
    app.logger.error(`[notif.export] failed: ${err.message}`, err));
  return worker;
}
