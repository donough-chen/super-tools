import { Application } from 'egg';
import { QueueLifecycle } from './app/queue';

export default class AppBootHook {
  private queueLifecycle: QueueLifecycle;

  constructor(private app: Application) {
    this.queueLifecycle = new QueueLifecycle(app);
  }

  async didReady() {
    // unittest 环境不启动队列 worker
    if (this.app.config.env !== 'unittest') {
      try {
        await this.queueLifecycle.start();
      } catch (e: any) {
        this.app.logger.error(`[notif] queue start failed (service will run without queue): ${e.message}`);
        this.app.logger.warn('[notif] notifications will use sync dispatch fallback until queue is available');
      }
    }
  }

  async beforeClose() {
    await this.queueLifecycle.stop();
  }
}
