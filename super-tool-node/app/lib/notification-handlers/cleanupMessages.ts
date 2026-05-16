import { registerScheduleHandler } from '../../service/notification-schedule';

registerScheduleHandler('cleanupMessages', async (ctx, params: { retentionDays?: number }) => {
  const cutoff = new Date(Date.now() - (params.retentionDays || 90) * 86400_000);
  const [r] = await ctx.model.query(
    'DELETE FROM notification_messages WHERE created_at < ? LIMIT 50000',
    { replacements: [cutoff] },
  ) as any;
  const affected = r?.affectedRows ?? 0;
  return { message: `deleted ${affected} messages older than ${cutoff.toISOString().slice(0, 10)}` };
});
