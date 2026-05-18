import BaseService from '../base';

export interface EffectivePreference {
  typeId: number; typeCode: string; typeName: string; channel: string; isSubscribed: boolean;
}

export default class NotificationPreferenceService extends BaseService {

  async getEffective(input: { userId: number; typeId: number; channel: string }): Promise<boolean> {
    const pref = await this.ctx.model.NotificationUserPreference.findOne({
      where: { userId: input.userId, typeId: input.typeId, channel: input.channel },
    });
    return pref ? !!pref.isSubscribed : true;
  }

  async isSubscribed(input: { userId: number; typeId: number; channel: string }): Promise<boolean> {
    const type = await this.ctx.model.NotificationType.findByPk(input.typeId);
    if (!type) return false;
    if (!type.userCancelable) return true;
    return this.getEffective(input);
  }

  async upsert(input: { userId: number; typeId: number; channel: string; isSubscribed: boolean }) {
    const { ctx } = this;
    if (!input.isSubscribed) {
      const type = await ctx.model.NotificationType.findByPk(input.typeId);
      if (type && !type.userCancelable) ctx.throw(400, '此通知类型不允许取消订阅');
    }
    const [row] = await ctx.model.NotificationUserPreference.upsert({
      userId: input.userId, typeId: input.typeId, channel: input.channel,
      isSubscribed: input.isSubscribed ? 1 : 0,
    });
    return row;
  }

  async listForUser(input: { userId: number }): Promise<EffectivePreference[]> {
    const { ctx } = this;
    const types = await ctx.model.NotificationType.findAll({ where: { status: 1 }, order: [['sortOrder', 'ASC']] });
    const prefs = await ctx.model.NotificationUserPreference.findAll({ where: { userId: input.userId } });
    const prefMap = new Map<string, any>();
    for (const p of prefs) prefMap.set(`${(p as any).typeId}:${(p as any).channel}`, p);

    const result: EffectivePreference[] = [];
    for (const type of types) {
      const t = type as any;
      for (const channel of (t.defaultChannels || [])) {
        const pref = prefMap.get(`${t.id}:${channel}`) as any;
        result.push({
          typeId: t.id, typeCode: t.code, typeName: t.name, channel,
          isSubscribed: pref ? !!pref.isSubscribed : true,
        });
      }
    }
    return result;
  }
}
