import * as jwt from 'jsonwebtoken';

/**
 * Socket.IO 连接鉴权中间件
 *
 * 从 handshake.auth.token 或 handshake.query.token 取 JWT，
 * 验证后将 user 信息挂载到 socket，并加入 user:{id} 房间。
 */
export default () => {
  return async (ctx: any, next: any) => {
    const socket = ctx.socket;
    const token =
      socket.handshake?.auth?.token ||
      socket.handshake?.query?.token ||
      '';

    if (!token) {
      ctx.app.logger.warn('[notif.io] no token provided, disconnect');
      socket.disconnect(true);
      return;
    }

    try {
      const secret = (ctx.app.config as any).jwt?.secret || 'super-tool-jwt-secret-2026';
      const decoded: any = jwt.verify(token, secret);
      socket.user = { id: decoded.id, username: decoded.username, role: decoded.role };
      socket.join(`user:${decoded.id}`);
      ctx.app.logger.info(`[notif.io] connected user=${decoded.id} sid=${socket.id}`);
      await next();
    } catch (e: any) {
      ctx.app.logger.warn(`[notif.io] invalid token: ${e.message}`);
      socket.disconnect(true);
    }
  };
};
