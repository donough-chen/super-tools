/**
 * @file 队列监控服务
 * @description 获取通知系统各 BullMQ 队列的 job 计数，用于管理端监控面板展示。
 * @module service/notification/queue-monitor
 */
import { Service } from 'egg';

export default class NotificationQueueMonitorService extends Service {
  /** 获取各队列的 job 计数（active/waiting/delayed/failed/completed） */
  async getDepths() {
    const results: Record<string, any> = {};
    for (const qName of ['notif.send', 'notif.export', 'notif.schedule']) {
      try {
        const { getSendQueue, getExportQueue } = require('../../queue/queues');
        let queue: any;
        if (qName === 'notif.send') queue = getSendQueue(this.app);
        else if (qName === 'notif.export') queue = getExportQueue(this.app);
        else continue;
        results[qName] = await queue.getJobCounts('active', 'waiting', 'delayed', 'failed', 'completed');
      } catch (e: any) { results[qName] = { error: e.message }; }
    }
    return results;
  }
}
