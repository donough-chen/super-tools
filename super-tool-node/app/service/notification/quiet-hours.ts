import BaseService from '../base';

export default class NotificationQuietHoursService extends BaseService {

  async isQuietNow(input: { userId: number; typeId: number; channel: 'in_app' | 'email' | 'sms'; priority: number }): Promise<{ quiet: boolean; reason?: string }> {
    const { ctx } = this;
    const notifConfig = (this.app.config as any).notification;
    if (!notifConfig?.quietHours?.enabled) return { quiet: false };

    const type = await ctx.model.NotificationType.findByPk(input.typeId, { attributes: ['quietHourPolicy', 'priority'] });
    const policy = (type as any)?.quietHourPolicy || 'respect';
    if (policy === 'bypass') return { quiet: false };
    if (policy === 'relax' && input.channel !== 'in_app') return { quiet: false };

    const userQuiet = await ctx.model.NotificationUserQuietHours.findOne({ where: { userId: input.userId } });
    if (userQuiet && (userQuiet as any).enabled) {
      const uq = userQuiet as any;
      if (input.priority === 0 && uq.receiveUrgent) return { quiet: false };
      const tz = uq.timezone || notifConfig.quietHours.defaultTimezone || 'Asia/Shanghai';
      if (this._isInTimeRange(uq.quietStart, uq.quietEnd, tz)) {
        return { quiet: true, reason: `user_quiet_hours (${uq.quietStart}-${uq.quietEnd} ${tz})` };
      }
    }

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
