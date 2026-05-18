import BaseService from '../base';
import { RATE_LIMIT_LUA } from '../../lib/rateLimitLua';

export default class NotificationRateLimitService extends BaseService {

  async isLimited(input: { userId: number; typeId: number; channel: string; priority: number }): Promise<{ limited: boolean; rule?: string }> {
    const notifConfig = (this.app.config as any).notification;
    if (!notifConfig?.rateLimit?.enabled) return { limited: false };
    const prefix = notifConfig.rateLimit.redisKeyPrefix || 'notif:rl:';
    const rules = await this._loadRules();

    for (const rule of rules) {
      if (!rule.enabled) continue;
      if (rule.skipPriority !== null && input.priority <= rule.skipPriority) continue;
      const key = this._buildKey(prefix, rule, input);
      if (!key) continue;
      try {
        const result = await this.app.redis.eval(RATE_LIMIT_LUA, 1, key,
          String(rule.windowSeconds || this._windowToSeconds(rule.window)), String(rule.maxCount)) as [number, number];
        if (result[0] === 1) {
          return { limited: true, rule: `${rule.scope}:${rule.window || rule.windowSeconds}s:${rule.maxCount} (current: ${result[1]})` };
        }
      } catch (e: any) {
        this.ctx.logger.warn(`[rate-limit] Redis eval failed for key ${key}: ${e.message}`);
      }
    }
    return { limited: false };
  }

  private async _loadRules(): Promise<any[]> {
    const cacheSeconds = (this.app.config as any).notification?.rateLimit?.cacheRulesSeconds || 300;
    return this.getOrSetCache('notif:rate_rules', async () => {
      return this.ctx.model.NotificationRateLimitConfig.findAll({ where: { enabled: 1 }, raw: true });
    }, cacheSeconds);
  }

  private _buildKey(prefix: string, rule: any, input: { userId: number; typeId: number; channel: string }): string | null {
    const win = rule.windowSeconds || this._windowToSeconds(rule.window);
    switch (rule.scope) {
      case 'global_user': case 'user_global': return `${prefix}ug:${input.userId}:${win}`;
      case 'user_type': return `${prefix}ut:${input.userId}:${input.typeId}:${win}`;
      case 'global': return `${prefix}g:${win}`;
      case 'channel':
        if (rule.targetKey === input.channel || rule.channel === input.channel) return `${prefix}ch:${input.channel}:${win}`;
        return null;
      case 'type': return `${prefix}t:${input.typeId}:${win}`;
      default: return null;
    }
  }

  private _windowToSeconds(window: string): number {
    switch (window) { case 'hour': return 3600; case 'day': return 86400; case 'week': return 604800; default: return 3600; }
  }
}
