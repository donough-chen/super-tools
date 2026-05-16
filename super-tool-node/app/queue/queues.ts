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

export async function closeQueues() {
  await sendQueue?.close();
  await sendQueueEvents?.close();
  sendQueue = null;
  sendQueueEvents = null;
}
