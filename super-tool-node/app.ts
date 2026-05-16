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

      // P2.2: 任务调度恢复 + stuck 扫描
      try {
        const ctx = this.app.createAnonymousContext();
        const recovered = await ctx.service.notificationTaskScheduler.recoverScheduledTasks();
        this.app.logger.info(`[scheduler] recovered ${recovered} cron/rrule tasks`);
        const stuck = await ctx.service.notificationTaskScheduler.scanStuckTasks();
        if (stuck > 0) this.app.logger.warn(`[scheduler] marked ${stuck} stuck tasks as failed`);
      } catch (e: any) {
        this.app.logger.error(`[scheduler] boot scan failed: ${e.message}`);
      }

      // P3.2: Schedule 系统注册（4 个内置 schedule）
      try {
        require('./app/lib/notification-handlers'); // 触发 handler 注册
        const ctx2 = this.app.createAnonymousContext();
        const registered = await ctx2.service.notificationSchedule.registerAll();
        this.app.logger.info(`[schedule] registered ${registered} schedule tasks`);
      } catch (e: any) {
        this.app.logger.error(`[schedule] boot register failed: ${e.message}`);
      }
    }
  }

  async beforeClose() {
    await this.queueLifecycle.stop();
  }
}
