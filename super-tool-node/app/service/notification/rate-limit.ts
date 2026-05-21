/**
 * @file 频率限制服务
 * @description 基于 Redis + Lua 脚本实现原子化的发送频率限制。
 *   支持多维度频控：global_user(全局用户级)、channel(渠道级)、type(类型级)。
 *   规则从 DB 加载并缓存 5 分钟（可配置），修改后通过清除缓存立即生效。
 *   支持按优先级豁免：skip_priority 以下的通知不受该规则约束。
 *
 * @module service/notification/rate-limit
 */
import BaseService from '../base';
import { RATE_LIMIT_LUA } from '../../lib/rateLimitLua';

export default class NotificationRateLimitService extends BaseService {

  /**
   * 检查是否触发频控限制
   * 遍历所有启用规则，通过 Redis Lua 原子计数判断是否超限
   * 返回 limited=true 时附带触发的规则描述
   */
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

  /** 从 DB 加载规则并缓存（默认 5 分钟，可通过 config 调整） */
  private async _loadRules(): Promise<any[]> {
    const cacheSeconds = (this.app.config as any).notification?.rateLimit?.cacheRulesSeconds || 300;
    return this.getOrSetCache('notif:rate_rules', async () => {
      return this.ctx.model.NotificationRateLimitConfig.findAll({ where: { enabled: 1 }, raw: true });
    }, cacheSeconds);
  }

  /** 根据规则 scope 构建 Redis key，不匹配则返回 null 跳过 */
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

  /** 将窗口名称转换为秒数 */
  private _windowToSeconds(window: string): number {
    switch (window) { case 'hour': return 3600; case 'day': return 86400; case 'week': return 604800; default: return 3600; }
  }
}
