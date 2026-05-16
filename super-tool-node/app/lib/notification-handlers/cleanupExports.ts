import * as fs from 'fs';
import { registerScheduleHandler } from '../../service/notification-schedule';

registerScheduleHandler('cleanupExports', async (ctx) => {
  const Op = ctx.app.Sequelize.Op;
  const expired = await ctx.model.NotificationExportJob.findAll({
    where: {
      status: 'completed',
      expires_at: { [Op.lt]: new Date() },
    } as any,
  });
  let cleaned = 0;
  for (const j of expired) {
    const jj = j as any;
    if (jj.filePath && fs.existsSync(jj.filePath)) {
      try { fs.unlinkSync(jj.filePath); } catch (_) {}
    }
    await jj.update({ status: 'expired', filePath: null });
    cleaned++;
  }
  return { message: `cleaned ${cleaned} expired export files` };
});
