import { Context } from 'egg';

/**
 * 邮件适配器（P1 仅 stub：打日志 + 写 send_log）
 * P2 集成 nodemailer 真实发送
 */
export default class EmailAdapter {
  constructor(private ctx: Context) {}

  async send(message: any): Promise<{ ok: boolean }> {
    const now = new Date();
    this.ctx.logger.info(`[email-stub] would send to userId=${message.userId} title="${message.title}"`);

    await this.ctx.model.NotificationSendLog.create({
      messageId: message.id,
      taskId: message.taskId || null,
      userId: message.userId,
      channel: 'email',
      provider: 'smtp',
      status: 'sent',
      attempt: 1,
      sentAt: now,
    });

    return { ok: true };
  }
}
