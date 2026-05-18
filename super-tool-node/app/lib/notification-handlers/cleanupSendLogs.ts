import { registerScheduleHandler } from '../../service/notification/schedule';

registerScheduleHandler('cleanupSendLogs', async (ctx, params: { retentionDays?: number }) => {
  const cutoff = new Date(Date.now() - (params.retentionDays || 30) * 86400_000);
  const [r] = await ctx.model.query(
    'DELETE FROM notification_send_logs WHERE created_at < ? LIMIT 50000',
    { replacements: [cutoff] },
  ) as any;
  const affected = r?.affectedRows ?? 0;
  return { message: `deleted ${affected} send_logs older than ${cutoff.toISOString().slice(0, 10)}` };
});
