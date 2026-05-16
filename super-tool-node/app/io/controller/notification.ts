import { Controller } from 'egg';

/**
 * Socket.IO 事件 controller
 * 处理客户端发来的事件
 */
export default class NotificationIoController extends Controller {

  /**
   * 客户端断开连接
   */
  async disconnect() {
    const { ctx } = this;
    const socket = ctx.socket;
    ctx.app.logger.info(`[notif.io] disconnect sid=${socket.id} user=${(socket as any).user?.id}`);
  }

  /**
   * 心跳探活
   */
  async heartbeat() {
    const { ctx } = this;
    ctx.socket.emit('heartbeat:ack', { ts: Date.now() });
  }
}
