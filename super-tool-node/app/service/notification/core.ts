/**
 * @file 通知核心发送服务
 * @description 通知系统的核心发送引擎，负责完整的发送流水线：
 *   1. 加载并校验通知类型
 *   2. 检查用户订阅偏好（preference）→ 过滤渠道
 *   3. 检查静默时段（quiet hours）→ 过滤渠道
 *   4. 检查频率限制（rate limit）→ 决定是否跳过
 *   5. 渲染模板 → 创建消息记录 → 入队异步发送
 *
 * 提供三种发送入口：
 * - send(): 单用户发送（经过完整过滤链）
 * - sendDirect(): 单用户直接发送（跳过偏好/静默/频控检查）
 * - sendByAudience(): 批量受众发送（逐用户调用 send）
 *
 * @module service/notification/core
 */
import BaseService from '../base';
import { getSendQueue } from '../../queue/queues';

/** 单用户发送入参 */
export interface SendInput {
  typeCode: string;       // 通知类型编码（如 BUSINESS_FEEDBACK_REPLY）
  userId: number;         // 目标用户ID
  variables: Record<string, any>;  // 模板渲染变量
  channels?: ('in_app' | 'email' | 'sms')[];  // 指定渠道（不传则使用类型默认渠道）
  taskId?: number | null;          // 关联任务ID
  idempotentKey?: string;          // 幂等键，防止重复发送
  extra?: Record<string, any>;     // 扩展数据（如跳转链接、图片等）
}

export interface SendDirectInput extends SendInput {}

/** 批量受众发送入参 */
export interface SendByAudienceInput {
  typeCode: string;
  audienceType: 'all' | 'static' | 'dynamic';  // 受众类型
  staticUserIds?: number[];   // static 模式下的用户ID列表
  dynamicRules?: any;         // dynamic 模式下的规则 JSON
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

  /**
   * 单用户发送（完整过滤链）
   * 流程：校验类型 → 偏好过滤 → 静默过滤 → 频控检查 → 分发
   * 任何环节被过滤都返回 skipped=true 并附带原因
   */
  async send(input: SendInput): Promise<SendResult> {
    const { ctx } = this;
    const ns = ctx.service.notification as any;
    const type = await this._loadEnabledType(input.typeCode);

    const defaultChannels: string[] = type.defaultChannels || [];
    const requestedChannels = input.channels || defaultChannels;

    // 第一层过滤：用户订阅偏好（稀疏存储，无记录=已订阅）
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

    // 第二层过滤：静默时段（按类型 policy 和用户配置判断）
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

    // 第三层过滤：频率限制（Redis 原子计数，超限则整体跳过）
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

  /** 直接发送（跳过偏好/静默/频控检查），用于测试发送和系统强制通知 */
  async sendDirect(input: SendDirectInput): Promise<SendResult> {
    const type = await this._loadEnabledType(input.typeCode);
    const channels = input.channels?.length ? input.channels : (type.defaultChannels || []);
    return this._dispatchToUser({
      type, userId: input.userId, channels, variables: input.variables,
      taskId: input.taskId ?? null, idempotentKey: input.idempotentKey, extra: input.extra,
    });
  }

  /** 批量受众发送：解析受众 → 逐用户调用 send()，统计成功/跳过/失败 */
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

  /** 加载并校验通知类型（必须存在且启用） */
  private async _loadEnabledType(typeCode: string) {
    const { ctx } = this;
    const type = await ctx.model.NotificationType.findOne({ where: { code: typeCode } });
    if (!type) ctx.throw(404, `通知类型 ${typeCode} 不存在`);
    if (!type.status) ctx.throw(400, `通知类型 ${typeCode} 已停用`);
    return type;
  }

  /**
   * 实际分发逻辑：渲染模板 → 创建消息记录 → 入队异步发送
   * 模板渲染失败时降级使用 variables 中的原始内容
   * 入队失败时降级为同步发送（保证消息不丢失）
   */
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
