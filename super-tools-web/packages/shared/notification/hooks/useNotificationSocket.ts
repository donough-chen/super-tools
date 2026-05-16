import { useEffect } from 'react';
import type { NotificationSocket } from '../socket/client';

/**
 * 管理 Socket 连接生命周期
 * enabled=true 时连接，组件卸载时断开
 */
export function useNotificationSocket(socket: NotificationSocket, enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    socket.connect();
    return () => socket.disconnect();
  }, [enabled, socket]);
}
