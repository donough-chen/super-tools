import BaseService from './base';

/**
 * 静默时段检查服务
 *
 * 检查逻辑：
 * 1. 类型 quietHourPolicy === 'bypass' → 不受静默约束，直接通过
 * 2. 用户级静默：notification_user_quiet_hours 表（P1 已建）
 * 3. 全局静默：config.notification.globalQuietHours
 * 4. policy='relax' 时仅跳过 in_app，email/sms 正常
 */
export default class NotificationQuietHoursService extends BaseService {

  /**
   * 检查是否在静默时段
   * @returns true = 命中静默，应跳过
   */
  async isQuietNow(input: {
    userId: number;
    typeId: number;
    channel: 'in_app' | 'email' | 'sms';
    priority: number;
  }): Promise<{ quiet: boolean; reason?: string }> {
    const { ctx } = this;
    const notifConfig = (this.app.config as any).notification;

    // 1. 功能开关
    if (!notifConfig?.quietHours?.enabled) {
      return { quiet: false };
    }

    // 2. 查类型的静默策略
    const type = await ctx.model.NotificationType.findByPk(input.typeId, {
      attributes: ['quietHourPolicy', 'priority'],
    });
    const policy = (type as any)?.quietHourPolicy || 'respect';

    if (policy === 'bypass') {
      return { quiet: false };
    }
    // relax 模式：仅 in_app 被静默，email/sms 放行
    if (policy === 'relax' && input.channel !== 'in_app') {
      return { quiet: false };
    }

    // 3. 用户级静默检查
    const userQuiet = await ctx.model.NotificationUserQuietHours.findOne({
      where: { userId: input.userId },
    });
    if (userQuiet && (userQuiet as any).enabled) {
      const uq = userQuiet as any;
      // P0 紧急通知如果用户允许接收紧急通知，则放行
      if (input.priority === 0 && uq.receiveUrgent) {
        return { quiet: false };
      }
      const tz = uq.timezone || notifConfig.quietHours.defaultTimezone || 'Asia/Shanghai';
      if (this._isInTimeRange(uq.quietStart, uq.quietEnd, tz)) {
        return { quiet: true, reason: `user_quiet_hours (${uq.quietStart}-${uq.quietEnd} ${tz})` };
      }
    }

    // 4. 全局静默检查
    const global = notifConfig.globalQuietHours;
    if (global?.enabled) {
      // 仅受全局静默约束的优先级才检查
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
   * 支持跨天（如 22:00-08:00）
   */
  private _isInTimeRange(start: string, end: string, timezone: string): boolean {
    if (!start || !end) return false;

    try {
      const now = new Date();
      // 获取指定时区的当前小时和分钟
      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        hour: 'numeric',
        minute: 'numeric',
        hour12: false,
      });
      const parts = formatter.formatToParts(now);
      const h = Number(parts.find(p => p.type === 'hour')?.value || 0);
      const m = Number(parts.find(p => p.type === 'minute')?.value || 0);
      const nowMinutes = h * 60 + m;

      const [sh, sm] = start.split(':').map(Number);
      const [eh, em] = end.split(':').map(Number);
      const startMinutes = sh * 60 + sm;
      const endMinutes = eh * 60 + em;

      if (startMinutes <= endMinutes) {
        // 不跨天：22:00-23:00
        return nowMinutes >= startMinutes && nowMinutes < endMinutes;
      } else {
        // 跨天：22:00-08:00 → [22:00, 24:00) 或 [0:00, 08:00)
        return nowMinutes >= startMinutes || nowMinutes < endMinutes;
      }
    } catch (e: any) {
      this.ctx.logger.warn(`[quiet-hours] time range check failed: ${e.message}`);
      return false;
    }
  }
}
