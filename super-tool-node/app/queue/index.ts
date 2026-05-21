/**
 * @file 队列生命周期管理器
 * @description 管理通知系统 BullMQ 队列的启动和停止。
 *   应用启动时初始化 send worker 和 export worker；
 *   应用关闭时优雅停止所有 worker 并关闭队列连接。
 *   通过 config.notification.enabled 控制是否启动队列。
 *
 * @module queue/index
 */
import { Application } from 'egg';
import { startSendWorker } from './workers/send.worker';
import { startExportWorker } from './workers/export.worker';
import { closeQueues } from './queues';

export class QueueLifecycle {
  private sendWorker: any = null;
  private exportWorker: any = null;

  constructor(private app: Application) {}

  async start() {
    const notifConfig = (this.app.config as any).notification;
    if (!notifConfig?.enabled) {
      this.app.logger.warn('[notif] notification disabled by config, skipping queue');
      return;
    }
    try {
      this.sendWorker = startSendWorker(this.app);
      this.exportWorker = startExportWorker(this.app);
      this.app.logger.info('[notif] queue lifecycle started (send + export workers)');
    } catch (e: any) {
      this.app.logger.error(`[notif] worker start failed: ${e.message}`);
    }
  }

  async stop() {
    await this.sendWorker?.close();
    await this.exportWorker?.close();
    await closeQueues();
    this.app.logger.info('[notif] queue lifecycle stopped');
  }
}
