import { Worker, Job } from 'bullmq';
import { Application } from 'egg';

export interface SendJobData {
  messageId: number;
  channel: 'in_app' | 'email' | 'sms';
}

export function startSendWorker(app: Application): Worker {
  const connection = {
    host: process.env.REDIS_HOST || '127.0.0.1',
    port: Number(process.env.REDIS_PORT) || 6379,
    password: process.env.REDIS_PASS || undefined,
    db: 0,
  };

  const concurrency = (app.config as any).notification?.queue?.sendConcurrency ?? 50;

  const worker = new Worker<SendJobData>(
    'notif.send',
    async (job: Job<SendJobData>) => {
      const ctx = app.createAnonymousContext();
      ctx.logger.info(`[notif.send] processing job=${job.id} messageId=${job.data.messageId} channel=${job.data.channel}`);

      const message = await ctx.model.NotificationMessage.findByPk(job.data.messageId);
      if (!message) {
        ctx.logger.warn(`[notif.send] message ${job.data.messageId} not found, skip`);
        return { skipped: true, reason: 'message_not_found' };
      }

      const result = await (ctx.service.notification as any).channel.dispatch({
        channel: job.data.channel,
        message,
      });
      return result;
    },
    { connection, concurrency },
  );

  worker.on('failed', (job, err) => {
    app.logger.error(`[notif.send] job=${job?.id} failed: ${err.message}`, err);
  });
  worker.on('completed', (job) => {
    app.logger.info(`[notif.send] job=${job.id} completed`);
  });

  return worker;
}
