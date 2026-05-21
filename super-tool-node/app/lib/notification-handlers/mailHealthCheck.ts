/**
 * @file 邮件健康检查处理器
 * @description 定时检测所有 SMTP 服务商的连通性，更新 channel_configs 的 health_status。
 *   handler key: 'mailHealthCheck'
 */
import { registerScheduleHandler } from '../../service/notification/schedule';

registerScheduleHandler('mailHealthCheck', async (ctx) => {
  await ctx.service.mail.healthCheckAll();
  return { message: 'mail health check done' };
});
