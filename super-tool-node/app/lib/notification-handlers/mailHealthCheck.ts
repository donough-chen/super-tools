import { registerScheduleHandler } from '../../service/notification-schedule';

registerScheduleHandler('mailHealthCheck', async (ctx) => {
  await ctx.service.mail.healthCheckAll();
  return { message: 'mail health check done' };
});
