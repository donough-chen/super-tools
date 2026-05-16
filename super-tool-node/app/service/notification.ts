import BaseService from './base';
import { getSendQueue } from '../queue/queues';

export interface SendInput {
  /** 通知类型 code（如 BUSINESS_FEEDBACK_REPLY） */
  typeCode: string;
  /** 接收用户 ID */
  userId: number;
  /** 模板变量 */
  variables: Record<string, any>;
  /** 可选：指定渠道（取与偏好的交集） */
  channels?: ('in_app' | 'email' | 'sms')[];
  /** 可选：关联任务 ID */
  taskId?: number | null;
  /** 可选：幂等键 */
  idempotentKey?: string;
  /** 可选：额外数据（存入 message.extra） */
  extra?: Record<string, any>;
}

export interface SendDirectInput extends SendInput {
  /** sendDirect 跳过用户偏好检查 */
}

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

/**
 * 通知系统主入口
 *
 * 串联：type → preference → template render → message 入库 → BullMQ 入队
 */
export default class NotificationService extends BaseService {

  /**
   * 单用户发送（尊重用户偏好）
   */
  async send(input: SendInput): Promise<SendResult> {
    const { ctx } = this;
    const type = await this._loadEnabledType(input.typeCode);

    // 检查偏好：过滤渠道
    const defaultChannels: string[] = type.defaultChannels || [];
    const requestedChannels = input.channels || defaultChannels;

    // 逐渠道检查偏好
    const allowedChannels: string[] = [];
    for (const ch of requestedChannels) {
      if (!defaultChannels.includes(ch) && !input.channels) continue;
      const subscribed = await ctx.service.notificationPreference.isSubscribed({
        userId: input.userId,
        typeId: type.id,
        channel: ch,
      });
      if (subscribed) allowedChannels.push(ch);
    }

    if (allowedChannels.length === 0) {
      return { skipped: true, reason: 'no_subscribed_channel', messages: [] };
    }

    // P2.1: 静默时段检查（逐渠道）
    const postQuietChannels: string[] = [];
    for (const ch of allowedChannels) {
      const quietResult = await ctx.service.notificationQuietHours.isQuietNow({
        userId: input.userId,
        typeId: type.id,
        channel: ch as any,
        priority: type.priority ?? 2,
      });
      if (!quietResult.quiet) {
        postQuietChannels.push(ch);
      } else {
        ctx.logger.info(`[notif] skipped ${ch} for userId=${input.userId}: ${quietResult.reason}`);
      }
    }
    if (postQuietChannels.length === 0) {
      return { skipped: true, reason: 'quiet_hours', messages: [] };
    }

    // P2.1: 频控检查
    const rateResult = await ctx.service.notificationRateLimit.isLimited({
      userId: input.userId,
      typeId: type.id,
      channel: postQuietChannels[0] as string,
      priority: type.priority ?? 2,
    });
    if (rateResult.limited) {
      ctx.logger.info(`[notif] rate limited userId=${input.userId}: ${rateResult.rule}`);
      return { skipped: true, reason: 'rate_limited', messages: [] };
    }

    return this._dispatchToUser({
      type,
      userId: input.userId,
      channels: postQuietChannels as any,
      variables: input.variables,
      taskId: input.taskId ?? null,
      idempotentKey: input.idempotentKey,
      extra: input.extra,
    });
  }

  /**
   * 强制发送（跳过用户偏好，用于安全/系统级通知）
   */
  async sendDirect(input: SendDirectInput): Promise<SendResult> {
    const type = await this._loadEnabledType(input.typeCode);
    const channels = input.channels && input.channels.length > 0
      ? input.channels
      : (type.defaultChannels || []);

    return this._dispatchToUser({
      type,
      userId: input.userId,
      channels,
      variables: input.variables,
      taskId: input.taskId ?? null,
      idempotentKey: input.idempotentKey,
      extra: input.extra,
    });
  }

  /**
   * 通过受众规则批量发送
   */
  async sendByAudience(input: SendByAudienceInput) {
    const { ctx } = this;
    const userIds = await ctx.service.notificationAudience.resolve({
      audienceType: input.audienceType,
      staticUserIds: input.staticUserIds,
      dynamicRules: input.dynamicRules,
    });

    let totalMessages = 0;
    let skippedCount = 0;
    for (const uid of userIds) {
      try {
        const r = await this.send({
          typeCode: input.typeCode,
          userId: uid,
          variables: input.variables,
          channels: input.channels,
          taskId: input.taskId ?? null,
        });
        if (r.skipped) {
          skippedCount++;
        } else {
          totalMessages += r.messages.length;
        }
      } catch (e: any) {
        ctx.logger.warn(`[notif.sendByAudience] user=${uid} failed: ${e.message}`);
      }
    }

    return { totalUsers: userIds.length, totalMessages, skippedCount };
  }

  // -------- 内部方法 --------

  /**
   * 加载并校验类型：存在 + 启用
   */
  private async _loadEnabledType(typeCode: string) {
    const { ctx } = this;
    const type = await ctx.model.NotificationType.findOne({
      where: { code: typeCode },
    });
    if (!type) {
      ctx.throw(404, `通知类型 ${typeCode} 不存在`);
    }
    if (!type.status) {
      ctx.throw(400, `通知类型 ${typeCode} 已停用`);
    }
    return type;
  }

  /**
   * 对单用户执行：渲染模板 → 入库 message → 入队 BullMQ
   */
  private async _dispatchToUser(args: {
    type: any;
    userId: number;
    channels: ('in_app' | 'email' | 'sms')[];
    variables: Record<string, any>;
    taskId: number | null;
    idempotentKey?: string;
    extra?: Record<string, any>;
  }): Promise<SendResult> {
    const { ctx, app } = this;
    const queue = getSendQueue(app);
    const messages: Array<{ id: number; channel: string }> = [];

    for (const channel of args.channels) {
      // 1. 渲染模板
      let title = '';
      let content = '';
      try {
        const rendered = await ctx.service.notificationTemplate.renderByCode({
          typeCode: args.type.code,
          channel,
          variables: args.variables,
        });
        title = rendered.title;
        content = rendered.content;
      } catch (e: any) {
        // 模板不存在时使用 fallback
        ctx.logger.warn(`[notif] template render failed for ${args.type.code}/${channel}: ${e.message}`);
        title = args.variables.title || '';
        content = args.variables.content || args.variables.body || JSON.stringify(args.variables);
      }

      // 2. 入库 message
      const msg = await ctx.model.NotificationMessage.create({
        taskId: args.taskId,
        userId: args.userId,
        typeId: args.type.id,
        templateId: null,
        templateVersion: null,
        title,
        content,
        summary: content.substring(0, 200),
        extra: args.extra || null,
        channels: JSON.stringify([channel]),
        priority: args.type.priority ?? 2,
        idempotentKey: args.idempotentKey
          ? `${args.idempotentKey}:${channel}`
          : null,
      });

      // 3. 入队
      try {
        await queue.add('send', {
          messageId: msg.id,
          channel,
        }, {
          jobId: `msg-${msg.id}-${channel}`,
        });
      } catch (e: any) {
        ctx.logger.error(`[notif] enqueue failed for messageId=${msg.id}: ${e.message}`);
        // 入队失败时直接同步分发（降级）
        try {
          await ctx.service.notificationChannel.dispatch({ channel, message: msg });
        } catch (dispatchErr: any) {
          ctx.logger.error(`[notif] sync dispatch fallback also failed: ${dispatchErr.message}`);
        }
      }

      messages.push({ id: msg.id, channel });
    }

    return { skipped: false, messages };
  }
}
