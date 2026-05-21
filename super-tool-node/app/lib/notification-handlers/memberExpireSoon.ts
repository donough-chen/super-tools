/**
 * @file 会员到期提醒处理器
 * @description 定时扫描即将到期的会员订阅，发送到期提醒通知。
 *   支持配置多个提醒窗口（默认 7天/3天/1天前），逐用户发送 MEMBER_EXPIRE_SOON 类型通知。
 *   handler key: 'memberExpireSoon'
 */
import { registerScheduleHandler } from '../../service/notification/schedule';

registerScheduleHandler('memberExpireSoon', async (ctx, params: { days?: number[] }) => {
  const days: number[] = params.days || [7, 3, 1];
  let total = 0;
  const Op = ctx.app.Sequelize.Op;
  for (const N of days) {
    const targetStart = new Date(Date.now() + N * 86400_000);
    targetStart.setHours(0, 0, 0, 0);
    const targetEnd = new Date(targetStart);
    targetEnd.setHours(23, 59, 59, 999);

    // 查找即将到期的会员订阅
    const [subs] = await ctx.model.query(`
      SELECT ms.user_id AS userId, ms.expire_at AS expireAt,
             u.nickname AS userName, ml.name AS levelName
      FROM member_subscriptions ms
      JOIN users u ON u.id = ms.user_id
      LEFT JOIN member_levels ml ON ml.id = ms.level_id
      WHERE ms.status = 1 AND ms.expire_at BETWEEN ? AND ?
    `, { replacements: [targetStart, targetEnd] }) as any;

    for (const sub of subs) {
      try {
        await ctx.service.notification.send({
          typeCode: 'MEMBER_EXPIRE_SOON',
          userId: sub.userId,
          variables: {
            userName: sub.userName || '用户',
            levelName: sub.levelName || '会员',
            daysLeft: N,
            expireAt: new Date(sub.expireAt).toLocaleDateString('zh-CN'),
          },
        });
        total++;
      } catch (e: any) {
        ctx.logger.warn(`[sched.memberExpire] user=${sub.userId} N=${N} failed: ${e.message}`);
      }
    }
  }
  return { message: `notified ${total} members across ${days.length} windows` };
});
