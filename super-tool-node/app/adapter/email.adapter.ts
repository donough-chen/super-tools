import { Context } from 'egg';
import { wrapHtmlEmail } from '../lib/htmlEmailRenderer';

/**
 * 邮件渠道适配器
 *
 * P2 真实实现：
 * 1. 查用户邮箱
 * 2. 渲染 HTML 模板
 * 3. 调用 mail.ts（nodemailer）发送
 * 4. 写 send_log
 */
export default class EmailAdapter {
  constructor(private ctx: Context) {}

  async send(message: any): Promise<{ ok: boolean; messageId?: string }> {
    const startTime = Date.now();

    // 1. 查用户邮箱
    const user = await this.ctx.model.User.findByPk(message.userId, {
      attributes: ['id', 'email'],
    });
    const email = (user as any)?.email;

    if (!email) {
      // 无邮箱，记录 skip
      await this.ctx.model.NotificationSendLog.create({
        messageId: message.id,
        taskId: message.taskId || null,
        userId: message.userId,
        channel: 'email',
        provider: 'smtp',
        status: 'skipped',
        skipReason: 'no_email',
        attempt: 1,
        sentAt: new Date(),
        costMs: Date.now() - startTime,
      });
      this.ctx.logger.info(`[email] skipped userId=${message.userId}: no email address`);
      return { ok: true }; // 不视为失败
    }

    // 2. 渲染 HTML
    const html = wrapHtmlEmail({
      title: message.title || '通知',
      content: message.content || '',
    });

    // 3. 发送
    try {
      const result = await this.ctx.service.mail.send({
        to: email,
        subject: message.title || '来自 super-tools 的通知',
        html,
      });

      // 4. 写成功 log
      await this.ctx.model.NotificationSendLog.create({
        messageId: message.id,
        taskId: message.taskId || null,
        userId: message.userId,
        channel: 'email',
        provider: 'smtp',
        status: 'delivered',
        target: email.replace(/(.{3}).*(@.*)/, '$1***$2'), // 脱敏
        requestId: result.messageId,
        attempt: 1,
        sentAt: new Date(),
        deliveredAt: new Date(),
        costMs: Date.now() - startTime,
        extra: { accepted: result.accepted },
      });

      return { ok: true, messageId: result.messageId };
    } catch (e: any) {
      // 写失败 log
      await this.ctx.model.NotificationSendLog.create({
        messageId: message.id,
        taskId: message.taskId || null,
        userId: message.userId,
        channel: 'email',
        provider: 'smtp',
        status: 'failed',
        target: email.replace(/(.{3}).*(@.*)/, '$1***$2'),
        errorMessage: e.message?.substring(0, 500),
        attempt: 1,
        sentAt: new Date(),
        costMs: Date.now() - startTime,
      });
      throw e;
    }
  }
}
