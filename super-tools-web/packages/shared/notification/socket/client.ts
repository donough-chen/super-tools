import { io, Socket } from 'socket.io-client';
import type { SocketEventMap } from '../types/events';

export interface SocketClientConfig {
  /** Socket.IO 服务地址（含命名空间，如 http://localhost:7001/notification） */
  url: string;
  /** 获取当前 token（异步以支持 refresh 场景） */
  getToken: () => string | null | Promise<string | null>;
  /** 重连尝试次数（默认 5） */
  reconnectionAttempts?: number;
  /** 重连间隔毫秒（默认 1000） */
  reconnectionDelay?: number;
}

export interface NotificationSocket {
  socket: Socket | null;
  connect: () => Promise<void>;
  disconnect: () => void;
  on: <K extends keyof SocketEventMap>(event: K, handler: (payload: SocketEventMap[K]) => void) => void;
  off: <K extends keyof SocketEventMap>(event: K, handler?: (payload: SocketEventMap[K]) => void) => void;
  isConnected: () => boolean;
}

export function createSocketClient(cfg: SocketClientConfig): NotificationSocket {
  let socket: Socket | null = null;

  return {
    get socket() { return socket; },

    async connect() {
      if (socket?.connected) return;
      const token = await cfg.getToken();
      if (!token) {
        console.warn('[notification-sdk] no token, skip socket connect');
        return;
      }
      socket = io(cfg.url, {
        transports: ['websocket'],
        auth: { token },
        reconnectionAttempts: cfg.reconnectionAttempts ?? 5,
        reconnectionDelay: cfg.reconnectionDelay ?? 1000,
      });
      socket.on('connect_error', (err) => {
        console.warn('[notification-sdk] connect_error:', err.message);
      });
    },

    disconnect() {
      socket?.disconnect();
      socket = null;
    },

    isConnected() {
      return !!socket?.connected;
    },

    on(event, handler) {
      socket?.on(event as string, handler as any);
    },

    off(event, handler) {
      if (handler) socket?.off(event as string, handler as any);
      else socket?.off(event as string);
    },
  };
}
