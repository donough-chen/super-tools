import BaseService from './base';
import InAppAdapter from '../adapter/in-app.adapter';
import EmailAdapter from '../adapter/email.adapter';
import SmsAdapter from '../adapter/sms.adapter';

/**
 * 渠道分发服务
 * 按 channel 选择适配器 → 调用 adapter.send() → 失败时写 send_log
 */
export default class NotificationChannelService extends BaseService {

  async dispatch(input: { channel: 'in_app' | 'email' | 'sms'; message: any }) {
    const { ctx } = this;

    let adapter: InAppAdapter | EmailAdapter | SmsAdapter;
    switch (input.channel) {
      case 'in_app':
        adapter = new InAppAdapter(ctx);
        break;
      case 'email':
        adapter = new EmailAdapter(ctx);
        break;
      case 'sms':
        adapter = new SmsAdapter(ctx);
        break;
      default:
        ctx.throw(400, `不支持的渠道: ${input.channel}`);
        return; // unreachable
    }

    try {
      return await adapter.send(input.message);
    } catch (e: any) {
      ctx.logger.error(`[notif-channel] dispatch failed for channel=${input.channel} messageId=${input.message.id}: ${e.message}`);
      // 写失败日志
      await ctx.model.NotificationSendLog.create({
        messageId: input.message.id,
        taskId: input.message.taskId || null,
        userId: input.message.userId,
        channel: input.channel,
        status: 'failed',
        errorMessage: e.message?.substring(0, 500),
        attempt: 1,
        sentAt: new Date(),
      });
      throw e;
    }
  }
}
