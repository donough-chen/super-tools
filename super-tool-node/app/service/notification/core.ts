import BaseService from '../base';
import { getSendQueue } from '../../queue/queues';

export interface SendInput {
  typeCode: string;
  userId: number;
  variables: Record<string, any>;
  channels?: ('in_app' | 'email' | 'sms')[];
  taskId?: number | null;
  idempotentKey?: string;
  extra?: Record<string, any>;
}

export interface SendDirectInput extends SendInput {}

export interface SendByAudienceInput {
  typeCode: string;
  audienceType: 'all' | 'static' | 'dynamic';
  staticUserIds?: number[];
  dynamicRules?: any;
  variables: Record<string, any>;
  channels?: ('in_app' | 'email' | 'sms')[];
  taskId?: number | null;
}

export interface SendResult {
  skipped: boolean;
  reason?: string;
  messages: Array<{ id: number; channel: string }>;
}

export default class NotificationCoreService extends BaseService {

  async send(input: SendInput): Promise<SendResult> {
    const { ctx } = this;
    const ns = ctx.service.notification as any;
    const type = await this._loadEnabledType(input.typeCode);

    const defaultChannels: string[] = type.defaultChannels || [];
    const requestedChannels = input.channels || defaultChannels;

    const allowedChannels: string[] = [];
    for (const ch of requestedChannels) {
      if (!defaultChannels.includes(ch) && !input.channels) continue;
      const subscribed = await ns.preference.isSubscribed({
        userId: input.userId, typeId: type.id, channel: ch,
      });
      if (subscribed) allowedChannels.push(ch);
    }
    if (allowedChannels.length === 0) {
      return { skipped: true, reason: 'no_subscribed_channel', messages: [] };
    }

    const postQuietChannels: string[] = [];
    for (const ch of allowedChannels) {
      const quietResult = await ns.quietHours.isQuietNow({
        userId: input.userId, typeId: type.id, channel: ch as any, priority: type.priority ?? 2,
      });
      if (!quietResult.quiet) postQuietChannels.push(ch);
      else ctx.logger.info(`[notif] skipped ${ch} for userId=${input.userId}: ${quietResult.reason}`);
    }
    if (postQuietChannels.length === 0) {
      return { skipped: true, reason: 'quiet_hours', messages: [] };
    }

    const rateResult = await ns.rateLimit.isLimited({
      userId: input.userId, typeId: type.id, channel: postQuietChannels[0], priority: type.priority ?? 2,
    });
    if (rateResult.limited) {
      ctx.logger.info(`[notif] rate limited userId=${input.userId}: ${rateResult.rule}`);
      return { skipped: true, reason: 'rate_limited', messages: [] };
    }

    return this._dispatchToUser({
      type, userId: input.userId, channels: postQuietChannels as any,
      variables: input.variables, taskId: input.taskId ?? null,
      idempotentKey: input.idempotentKey, extra: input.extra,
    });
  }

  async sendDirect(input: SendDirectInput): Promise<SendResult> {
    const type = await this._loadEnabledType(input.typeCode);
    const channels = input.channels?.length ? input.channels : (type.defaultChannels || []);
    return this._dispatchToUser({
      type, userId: input.userId, channels, variables: input.variables,
      taskId: input.taskId ?? null, idempotentKey: input.idempotentKey, extra: input.extra,
    });
  }

  async sendByAudience(input: SendByAudienceInput) {
    const { ctx } = this;
    const ns = ctx.service.notification as any;
    const userIds = await ns.audience.resolve({
      audienceType: input.audienceType, staticUserIds: input.staticUserIds, dynamicRules: input.dynamicRules,
    });

    let totalMessages = 0;
    let skippedCount = 0;
    for (const uid of userIds) {
      try {
        const r = await this.send({
          typeCode: input.typeCode, userId: uid, variables: input.variables,
          channels: input.channels, taskId: input.taskId ?? null,
        });
        if (r.skipped) skippedCount++;
        else totalMessages += r.messages.length;
      } catch (e: any) {
        ctx.logger.warn(`[notif.sendByAudience] user=${uid} failed: ${e.message}`);
      }
    }
    return { totalUsers: userIds.length, totalMessages, skippedCount };
  }

  private async _loadEnabledType(typeCode: string) {
    const { ctx } = this;
    const type = await ctx.model.NotificationType.findOne({ where: { code: typeCode } });
    if (!type) ctx.throw(404, `通知类型 ${typeCode} 不存在`);
    if (!type.status) ctx.throw(400, `通知类型 ${typeCode} 已停用`);
    return type;
  }

  private async _dispatchToUser(args: {
    type: any; userId: number; channels: ('in_app' | 'email' | 'sms')[];
    variables: Record<string, any>; taskId: number | null;
    idempotentKey?: string; extra?: Record<string, any>;
  }): Promise<SendResult> {
    const { ctx, app } = this;
    const ns = ctx.service.notification as any;
    const queue = getSendQueue(app);
    const messages: Array<{ id: number; channel: string }> = [];

    for (const channel of args.channels) {
      let title = '';
      let content = '';
      try {
        const rendered = await ns.template.renderByCode({
          typeCode: args.type.code, channel, variables: args.variables,
        });
        title = rendered.title;
        content = rendered.content;
      } catch (e: any) {
        ctx.logger.warn(`[notif] template render failed for ${args.type.code}/${channel}: ${e.message}`);
        title = args.variables.title || '';
        content = args.variables.content || args.variables.body || JSON.stringify(args.variables);
      }

      const msg = await ctx.model.NotificationMessage.create({
        taskId: args.taskId, userId: args.userId, typeId: args.type.id,
        templateId: null, templateVersion: null, title, content,
        summary: content.substring(0, 200), extra: args.extra || null,
        channels: JSON.stringify([channel]), priority: args.type.priority ?? 2,
        idempotentKey: args.idempotentKey ? `${args.idempotentKey}:${channel}` : null,
      });

      try {
        await queue.add('send', { messageId: msg.id, channel }, { jobId: `msg-${msg.id}-${channel}` });
      } catch (e: any) {
        ctx.logger.error(`[notif] enqueue failed for messageId=${msg.id}: ${e.message}`);
        try { await ns.channel.dispatch({ channel, message: msg }); }
        catch (dispatchErr: any) { ctx.logger.error(`[notif] sync dispatch fallback also failed: ${dispatchErr.message}`); }
      }
      messages.push({ id: msg.id, channel });
    }
    return { skipped: false, messages };
  }
}
