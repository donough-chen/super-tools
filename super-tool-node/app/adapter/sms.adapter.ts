import { Context } from 'egg';

/**
 * 短信适配器（P1 仅 stub：打日志 + 写 send_log）
 * P2 接入腾讯云 SMS
 */
export default class SmsAdapter {
  constructor(private ctx: Context) {}

  async send(message: any): Promise<{ ok: boolean }> {
    const now = new Date();
    this.ctx.logger.info(`[sms-stub] would send to userId=${message.userId} content="${message.content?.substring(0, 50)}"`);

    await this.ctx.model.NotificationSendLog.create({
      messageId: message.id,
      taskId: message.taskId || null,
      userId: message.userId,
      channel: 'sms',
      provider: 'mock',
      status: 'sent',
      attempt: 1,
      sentAt: now,
    });

    return { ok: true };
  }
}
