import { useEffect, useState } from 'react';
import type { NotificationSocket } from '../socket/client';

/**
 * 监听未读数（初始拉取 + Socket 实时更新）
 */
export function useUnreadCount(opts: {
  socket: NotificationSocket;
  fetchInitial: () => Promise<{ count: number }>;
}) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let mounted = true;
    opts.fetchInitial().then((r) => {
      if (mounted) setCount(r.count);
    }).catch(() => {});

    const handler = (p: { count: number }) => setCount(p.count);
    opts.socket.on('notification:unread_count', handler);
    return () => {
      mounted = false;
      opts.socket.off('notification:unread_count', handler);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return count;
}
