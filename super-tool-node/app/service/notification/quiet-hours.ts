/**
 * @file 静默时段服务
 * @description 判断当前时刻是否处于用户的免打扰时段。
 *   检查顺序：
 *   1. 全局开关（config.notification.quietHours.enabled）
 *   2. 通知类型的 quietHourPolicy（bypass=不受约束, relax=仅跳站内信）
 *   3. 用户个人静默配置（支持跨时区、跨午夜时段）
 *   4. 全局静默时段（仅影响指定优先级）
 *
 *   P0 紧急通知可通过 receive_urgent 配置豁免。
 *
 * @module service/notification/quiet-hours
 */
import BaseService from '../base';

export default class NotificationQuietHoursService extends BaseService {

  /**
   * 判断当前时刻是否处于静默时段
   * 返回 quiet=true 时附带原因（user_quiet_hours / global_quiet_hours）
   */
  async isQuietNow(input: { userId: number; typeId: number; channel: 'in_app' | 'email' | 'sms'; priority: number }): Promise<{ quiet: boolean; reason?: string }> {
    const { ctx } = this;
    const notifConfig = (this.app.config as any).notification;
    // 全局开关关闭则直接放行
    if (!notifConfig?.quietHours?.enabled) return { quiet: false };

    const type = await ctx.model.NotificationType.findByPk(input.typeId, { attributes: ['quietHourPolicy', 'priority'] });
    const policy = (type as any)?.quietHourPolicy || 'respect';
    // bypass: 不受静默约束（如验证码）
    if (policy === 'bypass') return { quiet: false };
    // relax: 仅跳过站内信，不跳 sms/email
    if (policy === 'relax' && input.channel !== 'in_app') return { quiet: false };

    // 检查用户个人静默配置
    const userQuiet = await ctx.model.NotificationUserQuietHours.findOne({ where: { userId: input.userId } });
    if (userQuiet && (userQuiet as any).enabled) {
      const uq = userQuiet as any;
      // P0 紧急通知且用户允许接收紧急消息时豁免
      if (input.priority === 0 && uq.receiveUrgent) return { quiet: false };
      const tz = uq.timezone || notifConfig.quietHours.defaultTimezone || 'Asia/Shanghai';
      if (this._isInTimeRange(uq.quietStart, uq.quietEnd, tz)) {
        return { quiet: true, reason: `user_quiet_hours (${uq.quietStart}-${uq.quietEnd} ${tz})` };
      }
    }

    // 检查全局静默时段（仅影响指定优先级，默认仅 P3）
    const global = notifConfig.globalQuietHours;
    if (global?.enabled) {
      const affected: number[] = global.affectedPriorities || [3];
      if (affected.includes(input.priority)) {
        const tz = global.timezone || 'Asia/Shanghai';
        if (this._isInTimeRange(global.start, global.end, tz)) {
          return { quiet: true, reason: `global_quiet_hours (${global.start}-${global.end} ${tz})` };
        }
      }
    }
    return { quiet: false };
  }

  /**
   * 判断当前时间是否在 [start, end) 范围内
   * 支持跨午夜（如 22:00-08:00）：start > end 时表示跨天
   */
  private _isInTimeRange(start: string, end: string, timezone: string): boolean {
    if (!start || !end) return false;
    try {
      const now = new Date();
      const formatter = new Intl.DateTimeFormat('en-US', { timeZone: timezone, hour: 'numeric', minute: 'numeric', hour12: false });
      const parts = formatter.formatToParts(now);
      const h = Number(parts.find(p => p.type === 'hour')?.value || 0);
      const m = Number(parts.find(p => p.type === 'minute')?.value || 0);
      const nowMinutes = h * 60 + m;
      const [sh, sm] = start.split(':').map(Number);
      const [eh, em] = end.split(':').map(Number);
      const startMinutes = sh * 60 + sm;
      const endMinutes = eh * 60 + em;
      if (startMinutes <= endMinutes) return nowMinutes >= startMinutes && nowMinutes < endMinutes;
      return nowMinutes >= startMinutes || nowMinutes < endMinutes;
    } catch (e: any) {
      this.ctx.logger.warn(`[quiet-hours] time range check failed: ${e.message}`);
      return false;
    }
  }
}
