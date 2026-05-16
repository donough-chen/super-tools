import { Service } from 'egg';

export default class NotificationQueueMonitorService extends Service {

  /**
   * 获取所有通知队列的深度信息
   */
  async getDepths() {
    const results: Record<string, any> = {};
    const queues = ['notif.send', 'notif.export', 'notif.schedule'];

    for (const qName of queues) {
      try {
        const { getSendQueue, getExportQueue } = require('../queue/queues');
        let queue: any;
        if (qName === 'notif.send') queue = getSendQueue(this.app);
        else if (qName === 'notif.export') queue = getExportQueue(this.app);
        else continue; // schedule queue 暂无独立 queue 实例

        const counts = await queue.getJobCounts('active', 'waiting', 'delayed', 'failed', 'completed');
        results[qName] = counts;
      } catch (e: any) {
        results[qName] = { error: e.message };
      }
    }
    return results;
  }
}
