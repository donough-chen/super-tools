import React, { useEffect, useState, useCallback } from 'react';
import { history } from 'umi';
import './index.less';

// H5 端直接用 shared utils/request
import { request } from '@/utils';

const NotificationsPage: React.FC = () => {
  const [list, setList] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(true);

  const fetchData = useCallback(async (p: number, append = false) => {
    setLoading(true);
    try {
      const res = await request('/api/notifications', { params: { page: p, pageSize: 20 } });
      if (res?.code === 200) {
        const newList = res.data?.list || [];
        setList((prev) => append ? [...prev, ...newList] : newList);
        setTotal(res.data?.total || 0);
        setHasMore(newList.length >= 20);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(1); }, [fetchData]);

  const loadMore = () => {
    if (!hasMore || loading) return;
    const next = page + 1;
    setPage(next);
    fetchData(next, true);
  };

  const handleMarkAllRead = async () => {
    await request('/api/notifications/mark-all-read', { method: 'POST' });
    fetchData(1);
  };

  const handleItemClick = async (item: any) => {
    if (!item.isRead) {
      await request('/api/notifications/mark-read', { method: 'POST', data: { ids: [item.id] } });
    }
    // TODO: 跳转到详情或业务页面
  };

  return (
    <div className="page-notifications">
      <div className="page-notifications__header">
        <span className="page-notifications__title">消息中心</span>
        <span className="page-notifications__action" onClick={handleMarkAllRead}>全部已读</span>
      </div>
      <div className="page-notifications__list">
        {list.length === 0 && !loading && (
          <div className="page-notifications__empty">暂无消息</div>
        )}
        {list.map((item: any) => (
          <div
            key={item.id}
            className={`page-notifications__item ${item.isRead ? '' : 'page-notifications__item--unread'}`}
            onClick={() => handleItemClick(item)}
          >
            <div className="page-notifications__item-title">{item.title || '通知'}</div>
            <div className="page-notifications__item-content">{item.summary || item.content?.substring(0, 80)}</div>
            <div className="page-notifications__item-time">{item.createdAt?.substring(0, 16)}</div>
          </div>
        ))}
        {hasMore && list.length > 0 && (
          <div className="page-notifications__load-more" onClick={loadMore}>
            {loading ? '加载中...' : '加载更多'}
          </div>
        )}
      </div>
    </div>
  );
};

export default NotificationsPage;
