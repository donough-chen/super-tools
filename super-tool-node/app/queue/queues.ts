/**
 * @file BullMQ 队列实例工厂
 * @description 提供通知系统所有 BullMQ 队列的单例获取和关闭方法。
 *   - notif.send: 消息发送队列（默认 3 次重试，指数退避 2s 起）
 *   - notif.export: 数据导出队列（默认 2 次重试，指数退避 5s 起）
 *
 *   队列连接使用环境变量 REDIS_HOST/REDIS_PORT/REDIS_PASS 配置。
 *
 * @module queue/queues
 */
import { Queue, QueueEvents } from 'bullmq';
import { Application } from 'egg';

let sendQueue: Queue | null = null;
let sendQueueEvents: QueueEvents | null = null;

function getRedisConnection(app: Application) {
  return {
    host: process.env.REDIS_HOST || '127.0.0.1',
    port: Number(process.env.REDIS_PORT) || 6379,
    password: process.env.REDIS_PASS || undefined,
    db: 0,
  };
}

export function getSendQueue(app: Application): Queue {
  if (!sendQueue) {
    sendQueue = new Queue('notif.send', {
      connection: getRedisConnection(app),
      defaultJobOptions: {
        attempts: (app.config as any).notification?.queue?.defaultAttempts ?? 3,
        backoff: { type: 'exponential', delay: 2000 },
        removeOnComplete: 1000,
        removeOnFail: 5000,
      },
    });
  }
  return sendQueue;
}

export function getSendQueueEvents(app: Application): QueueEvents {
  if (!sendQueueEvents) {
    sendQueueEvents = new QueueEvents('notif.send', {
      connection: getRedisConnection(app),
    });
  }
  return sendQueueEvents;
}

let exportQueue: Queue | null = null;

export function getExportQueue(app: Application): Queue {
  if (!exportQueue) {
    const expCfg = (app.config as any).notification?.export;
    exportQueue = new Queue(expCfg?.queueName || 'notif.export', {
      connection: getRedisConnection(app),
      defaultJobOptions: {
        attempts: 2,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: 500,
        removeOnFail: 2000,
      },
    });
  }
  return exportQueue;
}

export async function closeQueues() {
  await sendQueue?.close();
  await sendQueueEvents?.close();
  await exportQueue?.close();
  sendQueue = null;
  sendQueueEvents = null;
  exportQueue = null;
}
