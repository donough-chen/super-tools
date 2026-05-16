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
      await this.queueLifecycle.start();
    }
  }

  async beforeClose() {
    await this.queueLifecycle.stop();
  }
}
