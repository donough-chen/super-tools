import BaseService from './base';
import { RATE_LIMIT_LUA } from '../lib/rateLimitLua';

/**
 * 频控服务
 *
 * 三层检查：
 * 1. user + type 粒度
 * 2. user 全局粒度
 * 3. 全站粒度
 *
 * 每层使用 Redis Lua 原子计数器，TTL 自动过期。
 * 命中任意一层即返回 limited=true。
 */
export default class NotificationRateLimitService extends BaseService {

  /**
   * 检查是否命中频控
   * @returns true = 命中限制，应跳过
   */
  async isLimited(input: {
    userId: number;
    typeId: number;
    channel: string;
    priority: number;
  }): Promise<{ limited: boolean; rule?: string }> {
    const notifConfig = (this.app.config as any).notification;
    if (!notifConfig?.rateLimit?.enabled) {
      return { limited: false };
    }

    const prefix = notifConfig.rateLimit.redisKeyPrefix || 'notif:rl:';

    // 从 DB 加载规则（带缓存）
    const rules = await this._loadRules();

    for (const rule of rules) {
      if (!rule.enabled) continue;

      // P0 紧急通知跳过频控（如果规则配置了 skipPriority）
      if (rule.skipPriority !== null && input.priority <= rule.skipPriority) {
        continue;
      }

      const key = this._buildKey(prefix, rule, input);
      if (!key) continue;

      try {
        const result = await this.app.redis.eval(
          RATE_LIMIT_LUA,
          1,
          key,
          String(rule.windowSeconds || this._windowToSeconds(rule.window)),
          String(rule.maxCount),
        ) as [number, number];

        if (result[0] === 1) {
          return {
            limited: true,
            rule: `${rule.scope}:${rule.window || rule.windowSeconds}s:${rule.maxCount} (current: ${result[1]})`,
          };
        }
      } catch (e: any) {
        this.ctx.logger.warn(`[rate-limit] Redis eval failed for key ${key}: ${e.message}`);
        // Redis 不可用时不限制（降级放行）
      }
    }

    return { limited: false };
  }

  /**
   * 加载频控规则（带 Redis 缓存）
   */
  private async _loadRules(): Promise<any[]> {
    const cacheSeconds = (this.app.config as any).notification?.rateLimit?.cacheRulesSeconds || 300;
    return this.getOrSetCache('notif:rate_rules', async () => {
      const rows = await this.ctx.model.NotificationRateLimitConfig.findAll({
        where: { enabled: 1 },
        raw: true,
      });
      return rows;
    }, cacheSeconds);
  }

  /**
   * 构建 Redis key
   */
  private _buildKey(prefix: string, rule: any, input: { userId: number; typeId: number; channel: string }): string | null {
    const scope = rule.scope;
    const win = rule.windowSeconds || this._windowToSeconds(rule.window);
    switch (scope) {
      case 'global_user':
      case 'user_global':
        return `${prefix}ug:${input.userId}:${win}`;
      case 'user_type':
        return `${prefix}ut:${input.userId}:${input.typeId}:${win}`;
      case 'global':
        return `${prefix}g:${win}`;
      case 'channel':
        if (rule.targetKey === input.channel || rule.channel === input.channel) {
          return `${prefix}ch:${input.channel}:${win}`;
        }
        return null;
      case 'type':
        // 类型级频控
        return `${prefix}t:${input.typeId}:${win}`;
      default:
        return null;
    }
  }

  /**
   * P1 遗留 window 字段转秒数
   */
  private _windowToSeconds(window: string): number {
    switch (window) {
      case 'hour': return 3600;
      case 'day': return 86400;
      case 'week': return 604800;
      default: return 3600;
    }
  }
}
