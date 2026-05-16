import { Context } from 'egg';

/**
 * 短信适配器（P3.4 真实化：调项目已有 sms service）
 * fallbackToLog=true 时仅打日志（本地开发用）
 */
export default class SmsAdapter {
  constructor(private ctx: Context) {}

  async send(message: any): Promise<{ ok: boolean; providerResp?: any }> {
    const user = await this.ctx.model.User.findByPk(message.userId, { attributes: ['id', 'mobile'] });
    if (!user || !(user as any).mobile) {
      this.ctx.logger.info(`[sms] userId=${message.userId} has no mobile, skip`);
      await this.ctx.model.NotificationSendLog.create({
        messageId: message.id,
        taskId: message.taskId || null,
        userId: message.userId,
        channel: 'sms',
        provider: 'skip',
        status: 'skipped',
        attempt: 1,
        errorMessage: 'no_mobile',
      });
      return { ok: false };
    }

    const smsCfg = (this.ctx.app.config as any).notification?.sms;
    if (smsCfg?.fallbackToLog) {
      this.ctx.logger.info(`[sms-fallback] mobile=${(user as any).mobile} content="${message.content?.substring(0, 50)}"`);
      await this.ctx.model.NotificationSendLog.create({
        messageId: message.id,
        taskId: message.taskId || null,
        userId: message.userId,
        channel: 'sms',
        provider: 'fallback-log',
        status: 'sent',
        attempt: 1,
        sentAt: new Date(),
      });
      return { ok: true, providerResp: { fallback: true } };
    }

    // 真实发送：调用项目已有的 sms service
    try {
      const result = await this.ctx.service.sms.sendNotification({
        mobile: (user as any).mobile,
        content: message.content || message.title || '',
      });
      await this.ctx.model.NotificationSendLog.create({
        messageId: message.id,
        taskId: message.taskId || null,
        userId: message.userId,
        channel: 'sms',
        provider: 'tencent',
        status: 'sent',
        attempt: 1,
        sentAt: new Date(),
        rawResponse: JSON.stringify(result),
      });
      return { ok: true, providerResp: result };
    } catch (e: any) {
      this.ctx.logger.error(`[sms] send failed userId=${message.userId}: ${e.message}`);
      await this.ctx.model.NotificationSendLog.create({
        messageId: message.id,
        taskId: message.taskId || null,
        userId: message.userId,
        channel: 'sms',
        provider: 'tencent',
        status: 'failed',
        attempt: 1,
        errorMessage: e.message,
      });
      return { ok: false };
    }
  }
}
