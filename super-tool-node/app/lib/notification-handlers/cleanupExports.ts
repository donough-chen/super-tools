/**
 * @file 导出文件清理处理器
 * @description 定时清理已过期的导出文件：删除物理文件并将任务状态标记为 expired。
 *   handler key: 'cleanupExports'
 */
import * as fs from 'fs';
import { registerScheduleHandler } from '../../service/notification/schedule';

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
