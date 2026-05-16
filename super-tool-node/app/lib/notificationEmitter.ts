import { Application } from 'egg';

/**
 * 向指定用户推送 Socket.IO 事件
 * 使用 room 模式：每个用户连接时加入 `user:{userId}` 房间
 */
export function emitToUser(app: Application, userId: number, event: string, payload: any) {
  const io: any = (app as any).io;
  if (!io) {
    app.logger.warn('[notif] io not available, skip emit');
    return;
  }
  try {
    io.of('/notification').to(`user:${userId}`).emit(event, payload);
  } catch (err: any) {
    app.logger.error(`[notif] emitToUser failed: ${err.message}`, err);
  }
}
