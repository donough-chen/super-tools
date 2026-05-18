/**
 * 消息中心 /notifications
 *
 * 功能：
 * - 使用 notification SDK 分页拉取消息列表
 * - Socket 实时插入新消息（第一页）
 * - 点击消息标记已读后跳转详情页
 * - 全部已读
 * - 上拉加载更多
 */
import React, { useEffect, useState, useCallback, useRef } from 'react';
import { navigateBack, navigateTo } from '@/utils/navigator';
import AppHeader from '../../components/AppHeader';
import { notificationSdk, useNotificationStore } from '../../store';
import type { NotificationMessage } from '../../../../shared/notification';
import './index.less';

const PAGE_SIZE = 20;

const NotificationsPage: React.FC = () => {
  const [list, setList] = useState<NotificationMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const refreshUnread = useNotificationStore(s => s.refresh);
  const listRef = useRef(list);
  listRef.current = list;

  const fetchPage = useCallback(async (p: number, append = false) => {
    setLoading(true);
    try {
      const res = await notificationSdk.messages.list({ page: p, pageSize: PAGE_SIZE });
      const newList = res.list || [];
      setList(prev => append ? [...prev, ...newList] : newList);
      setTotal(res.total || 0);
      setHasMore(newList.length >= PAGE_SIZE);
    } catch {
      // 静默
    } finally {
      setLoading(false);
    }
  }, []);

  // 初始加载
  useEffect(() => { fetchPage(1); }, [fetchPage]);

  // Socket 实时新消息（仅第一页头插）
  useEffect(() => {
    const onNew = (payload: any) => {
      setList(prev => [payload as NotificationMessage, ...prev].slice(0, PAGE_SIZE));
      setTotal(t => t + 1);
    };
    notificationSdk.socket.on('notification:new', onNew);
    return () => { notificationSdk.socket.off('notification:new', onNew); };
  }, []);

  const loadMore = () => {
    if (!hasMore || loading) return;
    const next = page + 1;
    setPage(next);
    fetchPage(next, true);
  };

  const handleMarkAllRead = async () => {
    try {
      await notificationSdk.messages.markAllRead();
      // 刷新列表 + 未读数
      setPage(1);
      await fetchPage(1);
      refreshUnread();
    } catch {
      // 静默
    }
  };

  const handleItemClick = async (item: NotificationMessage) => {
    if (!item.isRead) {
      try {
        await notificationSdk.messages.markRead([item.id]);
        // 乐观更新本条已读状态
        setList(prev =>
          prev.map(m => m.id === item.id ? { ...m, isRead: 1 as const } : m),
        );
        refreshUnread();
      } catch {
        // 静默
      }
    }
    navigateTo(`/notifications/detail/${item.id}`);
  };

  /** 格式化时间 */
  const formatTime = (dateStr: string) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    if (isToday) {
      return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    }
    return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  };

  return (
    <div className="page-notifications">
      <AppHeader title="消息中心" showBack onBack={() => navigateBack()} />
      <main className="page-notifications__content">
        <div className="page-notifications__toolbar">
          <span className="page-notifications__count">{total > 0 ? `共 ${total} 条消息` : ''}</span>
          <span className="page-notifications__action" onClick={handleMarkAllRead}>全部已读</span>
        </div>
        <div className="page-notifications__list">
          {list.length === 0 && !loading && (
            <div className="page-notifications__empty">
              <div className="page-notifications__empty-icon" />
              <div className="page-notifications__empty-text">暂无消息</div>
            </div>
          )}
          {list.map((item) => (
            <div
              key={item.id}
              className={`page-notifications__item ${!item.isRead ? 'page-notifications__item--unread' : ''}`}
              onClick={() => handleItemClick(item)}
            >
              <div className="page-notifications__item-header">
                <span className="page-notifications__item-type">
                  {item.type?.name || '系统通知'}
                </span>
                <span className="page-notifications__item-time">{formatTime(item.createdAt)}</span>
              </div>
              <div className="page-notifications__item-title">{item.title || '通知'}</div>
              <div className="page-notifications__item-summary">
                {item.summary || item.content?.substring(0, 80)}
              </div>
              {!item.isRead && <div className="page-notifications__item-dot" />}
            </div>
          ))}
          {hasMore && list.length > 0 && (
            <div className="page-notifications__load-more" onClick={loadMore}>
              {loading ? '加载中...' : '加载更多'}
            </div>
          )}
          {!hasMore && list.length > 0 && (
            <div className="page-notifications__no-more">没有更多消息了</div>
          )}
        </div>
      </main>
    </div>
  );
};

export default NotificationsPage;
