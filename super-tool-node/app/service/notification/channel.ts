/**
 * @file 渠道分发服务
 * @description 根据渠道类型选择对应的适配器（InApp/Email/SMS）执行实际发送。
 *              发送失败时记录 send_log 并抛出异常（由上层决定是否重试）。
 * @module service/notification/channel
 */
import BaseService from '../base';
import InAppAdapter from '../../adapter/in-app.adapter';
import EmailAdapter from '../../adapter/email.adapter';
import SmsAdapter from '../../adapter/sms.adapter';

export default class NotificationChannelService extends BaseService {

  /**
   * 分发消息到指定渠道
   * 根据 channel 选择适配器实例，发送失败时记录 send_log 并抛出异常
   */
  async dispatch(input: { channel: 'in_app' | 'email' | 'sms'; message: any }) {
    const { ctx } = this;
    let adapter: InAppAdapter | EmailAdapter | SmsAdapter;
    switch (input.channel) {
      case 'in_app': adapter = new InAppAdapter(ctx); break;
      case 'email': adapter = new EmailAdapter(ctx); break;
      case 'sms': adapter = new SmsAdapter(ctx); break;
      default: ctx.throw(400, `不支持的渠道: ${input.channel}`); return;
    }
    try {
      return await adapter.send(input.message);
    } catch (e: any) {
      ctx.logger.error(`[notif-channel] dispatch failed for channel=${input.channel} messageId=${input.message.id}: ${e.message}`);
      await ctx.model.NotificationSendLog.create({
        messageId: input.message.id, taskId: input.message.taskId || null,
        userId: input.message.userId, channel: input.channel, status: 'failed',
        errorMessage: e.message?.substring(0, 500), attempt: 1, sentAt: new Date(),
      });
      throw e;
    }
  }
}
