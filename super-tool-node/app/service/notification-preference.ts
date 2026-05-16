import BaseService from './base';

export interface EffectivePreference {
  typeId: number;
  typeCode: string;
  typeName: string;
  channel: string;
  isSubscribed: boolean;
}

/**
 * 用户通知偏好服务
 *
 * P1 仅实现读写，不解析静默时段（P2 做）。
 * 稀疏存储：notification_user_preferences 表无记录 = 默认订阅。
 */
export default class NotificationPreferenceService extends BaseService {

  /**
   * 获取用户对某类型+渠道的有效偏好
   * 无记录时返回默认订阅（isSubscribed=true）
   */
  async getEffective(input: { userId: number; typeId: number; channel: string }): Promise<boolean> {
    const { ctx } = this;
    const pref = await ctx.model.NotificationUserPreference.findOne({
      where: { userId: input.userId, typeId: input.typeId, channel: input.channel },
    });
    // 无记录 = 默认订阅
    return pref ? !!pref.isSubscribed : true;
  }

  /**
   * 检查用户是否订阅了某类型的某渠道
   * 同时检查类型是否允许用户取消订阅
   */
  async isSubscribed(input: { userId: number; typeId: number; channel: string }): Promise<boolean> {
    const { ctx } = this;
    const type = await ctx.model.NotificationType.findByPk(input.typeId);
    if (!type) return false;

    // 不可取消的类型始终视为已订阅
    if (!type.userCancelable) return true;

    return this.getEffective(input);
  }

  /**
   * 更新偏好（upsert）
   */
  async upsert(input: {
    userId: number;
    typeId: number;
    channel: string;
    isSubscribed: boolean;
  }) {
    const { ctx } = this;

    // 检查类型是否允许取消订阅
    if (!input.isSubscribed) {
      const type = await ctx.model.NotificationType.findByPk(input.typeId);
      if (type && !type.userCancelable) {
        ctx.throw(400, '此通知类型不允许取消订阅');
      }
    }

    const [row] = await ctx.model.NotificationUserPreference.upsert({
      userId: input.userId,
      typeId: input.typeId,
      channel: input.channel,
      isSubscribed: input.isSubscribed ? 1 : 0,
    });
    return row;
  }

  /**
   * 获取用户所有类型的偏好列表（合并默认值）
   */
  async listForUser(input: { userId: number }): Promise<EffectivePreference[]> {
    const { ctx } = this;

    // 所有启用的类型
    const types = await ctx.model.NotificationType.findAll({
      where: { status: 1 },
      order: [['sortOrder', 'ASC']],
    });

    // 用户已设置的偏好
    const prefs = await ctx.model.NotificationUserPreference.findAll({
      where: { userId: input.userId },
    });
    const prefMap = new Map<string, any>();
    for (const p of prefs) {
      prefMap.set(`${(p as any).typeId}:${(p as any).channel}`, p);
    }

    const result: EffectivePreference[] = [];
    for (const type of types) {
      const t = type as any;
      const channels: string[] = t.defaultChannels || [];
      for (const channel of channels) {
        const key = `${t.id}:${channel}`;
        const pref = prefMap.get(key) as any;
        result.push({
          typeId: t.id,
          typeCode: t.code,
          typeName: t.name,
          channel,
          isSubscribed: pref ? !!pref.isSubscribed : true,
        });
      }
    }
    return result;
  }
}
