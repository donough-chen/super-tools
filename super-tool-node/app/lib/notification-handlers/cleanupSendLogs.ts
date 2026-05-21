/**
 * @file 发送日志清理处理器
 * @description 定时清理过期的 notification_send_logs 记录。
 *   默认保留 30 天，每次最多删除 50000 条。
 *   handler key: 'cleanupSendLogs'
 */
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
