import { Context } from 'egg';
import { emitToUser } from '../lib/notificationEmitter';

/**
 * 站内信适配器
 * 消息已入库（notification_messages），仅需推送 Socket 事件 + 写 send_log
 */
export default class InAppAdapter {
  constructor(private ctx: Context) {}

  async send(message: any): Promise<{ ok: boolean; deliveredAt: Date }> {
    const now = new Date();

    // 写 send_log
    await this.ctx.model.NotificationSendLog.create({
      messageId: message.id,
      taskId: message.taskId || null,
      userId: message.userId,
      channel: 'in_app',
      provider: 'native',
      status: 'delivered',
      attempt: 1,
      sentAt: now,
      deliveredAt: now,
    });

    // Socket 推送新消息事件
    emitToUser(this.ctx.app, message.userId, 'notification:new', {
      id: message.id,
      typeId: message.typeId,
      title: message.title,
      content: message.content,
      priority: message.priority,
      createdAt: message.createdAt,
    });

    // 推送未读数更新
    const unread = await this.ctx.model.NotificationMessage.count({
      where: { userId: message.userId, isRead: 0, isArchived: 0 },
    });
    emitToUser(this.ctx.app, message.userId, 'notification:unread_count', { count: unread });

    return { ok: true, deliveredAt: now };
  }
}
