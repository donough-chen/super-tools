import { Application } from 'egg';
import { startSendWorker } from './workers/send.worker';
import { closeQueues } from './queues';

export class QueueLifecycle {
  private worker: any = null;

  constructor(private app: Application) {}

  async start() {
    const notifConfig = (this.app.config as any).notification;
    if (!notifConfig?.enabled) {
      this.app.logger.warn('[notif] notification disabled by config, skipping queue');
      return;
    }
    try {
      this.worker = startSendWorker(this.app);
      this.app.logger.info('[notif] queue lifecycle started');
    } catch (e: any) {
      this.app.logger.error(`[notif] worker start failed: ${e.message}`);
    }
  }

  async stop() {
    await this.worker?.close();
    await closeQueues();
    this.app.logger.info('[notif] queue lifecycle stopped');
  }
}
