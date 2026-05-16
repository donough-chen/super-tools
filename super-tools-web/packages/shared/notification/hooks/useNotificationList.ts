import { useCallback, useEffect, useState } from 'react';
import type { NotificationMessage } from '../types/domain';
import type { NotificationSocket } from '../socket/client';

export interface UseNotificationListOpts {
  socket: NotificationSocket;
  fetchPage: (params: { page: number; pageSize: number }) => Promise<{ list: NotificationMessage[]; total: number }>;
  pageSize?: number;
}

/**
 * 消息列表（分页拉取 + Socket 新消息实时插入）
 */
export function useNotificationList(opts: UseNotificationListOpts) {
  const [list, setList] = useState<NotificationMessage[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const pageSize = opts.pageSize ?? 20;

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const r = await opts.fetchPage({ page, pageSize });
      setList(r.list);
      setTotal(r.total);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { reload(); }, [reload]);

  // 实时新消息：仅在第一页时头插
  useEffect(() => {
    const onNew = (payload: any) => {
      if (page === 1) {
        setList((prev) => [payload as NotificationMessage, ...prev].slice(0, pageSize));
        setTotal((t) => t + 1);
      }
    };
    opts.socket.on('notification:new', onNew);
    return () => opts.socket.off('notification:new', onNew);
  }, [page, pageSize, opts.socket]);

  return { list, total, page, setPage, pageSize, loading, reload };
}
