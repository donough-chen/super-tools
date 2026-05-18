/**
 * 消息详情 /notifications/detail/:id
 *
 * 功能：
 * - 通过 SDK 拉取消息详情
 * - 展示完整 body（HTML 渲染）
 * - 归档操作
 * - 自动标记已读
 */
import React, { useEffect, useState, useCallback } from 'react';
import { navigateBack } from '@/utils/navigator';
import AppHeader from '../../../components/AppHeader';
import { notificationSdk, useNotificationStore } from '../../../store';
import { showToast } from '../../../utils/toast';
import type { NotificationMessage } from '../../../../../shared/notification';
import './index.less';

interface Props {
  match: { params: { id: string } };
}

const NotificationDetailPage: React.FC<Props> = ({ match }) => {
  const id = match?.params?.id;
  const [detail, setDetail] = useState<NotificationMessage | null>(null);
  const [loading, setLoading] = useState(true);
  const [archiving, setArchiving] = useState(false);
  const refreshUnread = useNotificationStore(s => s.refresh);

  const fetchDetail = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const data = await notificationSdk.messages.detail(Number(id));
      setDetail(data);

      // 自动标记已读
      if (data && !data.isRead) {
        await notificationSdk.messages.markRead([data.id]);
        setDetail(prev => prev ? { ...prev, isRead: 1 as const } : prev);
        refreshUnread();
      }
    } catch {
      showToast('消息加载失败', 'error');
    } finally {
      setLoading(false);
    }
  }, [id, refreshUnread]);

  useEffect(() => { fetchDetail(); }, [fetchDetail]);

  const handleArchive = async () => {
    if (!detail || archiving) return;
    setArchiving(true);
    try {
      await notificationSdk.messages.archive(detail.id);
      showToast('已归档');
      setDetail(prev => prev ? { ...prev, isArchived: 1 as const } : prev);
    } catch {
      showToast('归档失败', 'error');
    } finally {
      setArchiving(false);
    }
  };

  /** 格式化完整时间 */
  const formatFullTime = (dateStr: string) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const h = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    return `${y}-${m}-${day} ${h}:${min}`;
  };

  return (
    <div className="page-notif-detail">
      <AppHeader title="消息详情" showBack onBack={() => navigateBack()} />
      <main className="page-notif-detail__content">
        {loading && (
          <div className="page-notif-detail__loading">加载中...</div>
        )}
        {!loading && !detail && (
          <div className="page-notif-detail__empty">消息不存在或已被删除</div>
        )}
        {!loading && detail && (
          <>
            <div className="page-notif-detail__header">
              <div className="page-notif-detail__type-tag">
                {detail.type?.name || '系统通知'}
              </div>
              <h2 className="page-notif-detail__title">{detail.title}</h2>
              <div className="page-notif-detail__meta">
                <span>{formatFullTime(detail.createdAt)}</span>
                {detail.isRead ? (
                  <span className="page-notif-detail__status page-notif-detail__status--read">已读</span>
                ) : (
                  <span className="page-notif-detail__status page-notif-detail__status--unread">未读</span>
                )}
              </div>
            </div>

            <div className="page-notif-detail__body">
              {/* 支持 HTML 内容渲染 */}
              <div
                className="page-notif-detail__html"
                dangerouslySetInnerHTML={{ __html: detail.content || '' }}
              />
            </div>

            <div className="page-notif-detail__actions">
              {!detail.isArchived ? (
                <button
                  className="page-notif-detail__btn page-notif-detail__btn--archive"
                  onClick={handleArchive}
                  disabled={archiving}
                >
                  {archiving ? '归档中...' : '归档此消息'}
                </button>
              ) : (
                <div className="page-notif-detail__archived-tag">已归档</div>
              )}
            </div>
          </>
        )}
      </main>
    </div>
  );
};

export default NotificationDetailPage;
