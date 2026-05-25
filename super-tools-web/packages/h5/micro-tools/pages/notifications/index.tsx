/**
 * 消息中心 /notifications
 *
 * 功能：
 * - 顶部 AppTabs（multiple 模式）按消息分类切换，分类前端硬编码（system/business/marketing），
 *   对应后端 notification_types.category 字段，避免动态拉取大量子类型造成 Tab 过多
 * - 使用 notification SDK 分页拉取消息列表（接口接受 category 过滤参数）
 * - Socket 实时插入新消息（第一页）
 * - 点击消息标记已读后跳转详情页
 * - 全部已读
 * - 上拉加载更多
 * - 列表项左滑：标记已读 / 删除（归档）
 */
import React, { useEffect, useState, useCallback, useRef } from 'react';
import { navigateBack, navigateTo } from '@/utils/navigator';
import AppHeader from '../../components/AppHeader';
import AppTabs from '../../components/AppTabs';
import type { TabItem } from '../../components/AppTabs';
import { notificationSdk, useNotificationStore } from '../../store';
import type { NotificationMessage } from '../../../../shared/notification';
import { resolveIcon } from '../../utils/icon';
import './index.less';

const PAGE_SIZE = 20;

// ==================== 分类 Tabs（前端硬编码） ====================
// 与 notification_types.category 字段一一对应，避免动态拉取大量子类型造成 Tab 过多
// 详见后端表 018_add_notification_system.sql / model/notification_type.ts
type CategoryKey = 'all' | 'system' | 'business' | 'marketing';

interface CategoryTab {
  /** Tab 唯一 key（同时作为接口 category 参数；'all' 表示不过滤） */
  key: CategoryKey;
  /** Tab 展示名 */
  name: string;
}

const CATEGORY_TABS: CategoryTab[] = [
  { key: 'all',       name: '全部' },
  { key: 'system',    name: '系统通知' },
  { key: 'business',  name: '业务通知' },
  { key: 'marketing', name: '活动通知' },
];

// ==================== 左滑操作按钮宽度 ====================
// 未读时：标记已读 + 删除 = 2 个按钮；已读时：仅删除 = 1 个按钮
const BTN_WIDTH = 120; // 单个按钮宽度（px）

// ==================== SwipeableItem ====================

interface SwipeableItemProps {
  item: NotificationMessage;
  openId: number | null;
  setOpenId: (id: number | null) => void;
  onItemClick: (item: NotificationMessage) => void;
  onMarkRead: (item: NotificationMessage) => void;
  onDelete: (item: NotificationMessage) => void;
  formatTime: (dateStr: string) => string;
}

const SwipeableItem: React.FC<SwipeableItemProps> = ({
  item,
  openId,
  setOpenId,
  onItemClick,
  onMarkRead,
  onDelete,
  formatTime,
}) => {
  const isOpen = openId === item.id;

  const translateX = useRef(0);
  const startX = useRef(0);
  const startY = useRef(0);
  const isDragging = useRef(false);
  const isHorizontal = useRef<boolean | null>(null);
  // 整个滑动轨道（内容层 + 按钮层并排）
  const trackRef = useRef<HTMLDivElement>(null);
  // 按钮层，用于运行时读取实际渲染宽度
  const actionsRef = useRef<HTMLDivElement>(null);

  /** 读取按钮层实际渲染宽度（已经过 px→vw 转换后的真实像素） */
  const getMaxTranslate = () => actionsRef.current?.offsetWidth ?? BTN_WIDTH * (item.isRead ? 1 : 2);

  // 同步外部 openId 变化（其他 item 展开时收起自己）
  useEffect(() => {
    if (!isOpen) {
      translateX.current = 0;
      if (trackRef.current) {
        trackRef.current.style.transition = 'transform 0.25s cubic-bezier(0.25,0.46,0.45,0.94)';
        trackRef.current.style.transform = 'translateX(0)';
      }
    }
  }, [isOpen]);

  const applyTranslate = (x: number, animated = false) => {
    if (!trackRef.current) return;
    trackRef.current.style.transition = animated
      ? 'transform 0.25s cubic-bezier(0.25,0.46,0.45,0.94)'
      : 'none';
    trackRef.current.style.transform = `translateX(${x}px)`;
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    startX.current = e.touches[0].clientX;
    startY.current = e.touches[0].clientY;
    isDragging.current = true;
    isHorizontal.current = null;
    const maxTranslate = getMaxTranslate();
    translateX.current = isOpen ? -maxTranslate : 0;
    if (trackRef.current) {
      trackRef.current.style.transition = 'none';
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging.current) return;
    const dx = e.touches[0].clientX - startX.current;
    const dy = e.touches[0].clientY - startY.current;

    if (isHorizontal.current === null) {
      if (Math.abs(dx) < 5 && Math.abs(dy) < 5) return;
      isHorizontal.current = Math.abs(dx) > Math.abs(dy);
    }
    if (!isHorizontal.current) return;

    e.preventDefault();

    const maxTranslate = getMaxTranslate();
    const newX = Math.min(0, Math.max(-maxTranslate, translateX.current + dx));
    applyTranslate(newX);
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!isDragging.current) return;
    isDragging.current = false;
    if (!isHorizontal.current) return;

    const maxTranslate = getMaxTranslate();
    const dx = e.changedTouches[0].clientX - startX.current;
    const currentX = translateX.current + dx;

    if (currentX < -maxTranslate / 2) {
      translateX.current = -maxTranslate;
      applyTranslate(-maxTranslate, true);
      setOpenId(item.id);
    } else {
      translateX.current = 0;
      applyTranslate(0, true);
      setOpenId(null);
    }
  };

  const handleInnerClick = () => {
    if (isOpen) {
      applyTranslate(0, true);
      setOpenId(null);
      return;
    }
    onItemClick(item);
  };

  return (
    <div className="page-notifications__swipe-wrap">
      {/* 滑动轨道：内容层 + 按钮层并排，整体平移 */}
      <div
        ref={trackRef}
        className="page-notifications__swipe-track"
      >
      {/* 内容层 */}
      <div
        className={`page-notifications__item${!item.isRead ? ' page-notifications__item--unread' : ''}`}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onClick={handleInnerClick}
      >
        {/* 左侧头像 */}
        <div className="page-notifications__item-avatar">
          {item.type?.icon
              ? <img className="page-notifications__item-avatar-img" src={resolveIcon(item.type.icon)} alt={item.type.name} />
            : <span className="page-notifications__item-avatar-fallback">{(item.type?.name || '通')[0]}</span>
          }
          {!item.isRead && <span className="page-notifications__item-badge" />}
        </div>

        {/* 右侧内容 */}
        <div className="page-notifications__item-body">
          {/* 第一行：类型标签 + 标题 + 时间 */}
          <div className="page-notifications__item-row1">
            <span className="page-notifications__item-type">{item.type?.name || '系统通知'}</span>
            <span className="page-notifications__item-title">{item.title || '通知'}</span>
            <span className="page-notifications__item-time">{formatTime(item.createdAt)}</span>
          </div>
          {/* 第二行：摘要 */}
          <div className="page-notifications__item-summary">
            {item.summary || item.content?.substring(0, 80)}
          </div>
        </div>
      </div>

      {/* 操作按钮层（紧跟内容层右侧，随 track 一起平移） */}
      <div ref={actionsRef} className="page-notifications__swipe-actions">
        {!item.isRead && (
          <button
            className="page-notifications__swipe-btn page-notifications__swipe-btn--read"
            onClick={(e) => { e.stopPropagation(); onMarkRead(item); }}
          >
            标记已读
          </button>
        )}
        <button
          className="page-notifications__swipe-btn page-notifications__swipe-btn--delete"
          onClick={(e) => { e.stopPropagation(); onDelete(item); }}
        >
          删除
        </button>
      </div>
      </div>{/* end swipe-track */}
    </div>
  );
};

// ==================== 主页面 ====================

const NotificationsPage: React.FC = () => {
  // ---- 分类 Tab（前端硬编码，避免请求过多子类型） ----
  const tabs: TabItem[] = CATEGORY_TABS.map(t => ({ key: t.key, name: t.name }));
  const [activeTabIndex, setActiveTabIndex] = useState(0);

  // ---- 消息列表 ----
  const [list, setList] = useState<NotificationMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const refreshUnread = useNotificationStore(s => s.refresh);
  const listRef = useRef(list);
  listRef.current = list;

  // ---- 左滑状态：当前展开的 item id ----
  const [openId, setOpenId] = useState<number | null>(null);

  /** 当前选中的 category（undefined = 全部，不传后端过滤参数） */
  const activeCategory: Exclude<CategoryKey, 'all'> | undefined = (() => {
    const key = CATEGORY_TABS[activeTabIndex]?.key;
    return key && key !== 'all' ? key : undefined;
  })();

  // ---- 拉取消息列表 ----
  const fetchPage = useCallback(
    async (p: number, category: Exclude<CategoryKey, 'all'> | undefined, append = false) => {
      setLoading(true);
      try {
        const res = await notificationSdk.messages.list({
          page: p,
          pageSize: PAGE_SIZE,
          ...(category ? { category } : {}),
        });
        const newList = res.list || [];
        setList(prev => append ? [...prev, ...newList] : newList);
        setTotal(res.total || 0);
        setHasMore(newList.length >= PAGE_SIZE);
      } catch {
        // 静默
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  // Tab 切换时重置并重新拉取
  useEffect(() => {
    setPage(1);
    setList([]);
    setHasMore(true);
    setOpenId(null);
    fetchPage(1, activeCategory);
  }, [activeTabIndex, activeCategory, fetchPage]);

  // Socket 实时新消息
  // socket 推送 payload 不带 type.category（见 in-app.adapter.ts），
  // 故无法在前端精确判定是否属于当前分类。策略：
  //   - 当前 tab 是“全部”：直接顶部插入
  //   - 当前 tab 是某分类：触发一次首页刷新兜底，避免错插到非匹配分类
  useEffect(() => {
    const onNew = (payload: any) => {
      if (!activeCategory) {
        const msg = payload as NotificationMessage;
        setList(prev => [msg, ...prev].slice(0, PAGE_SIZE));
        setTotal(t => t + 1);
      } else {
        // 兜底刷新当前分类首页
        fetchPage(1, activeCategory);
      }
    };
    notificationSdk.socket.on('notification:new', onNew);
    return () => { notificationSdk.socket.off('notification:new', onNew); };
  }, [activeCategory, fetchPage]);

  const loadMore = () => {
    if (!hasMore || loading) return;
    const next = page + 1;
    setPage(next);
    fetchPage(next, activeCategory, true);
  };

  const handleTabChange = (index: number) => {
    if (index === activeTabIndex) return;
    setActiveTabIndex(index);
  };

  const handleMarkAllRead = async () => {
    try {
      await notificationSdk.messages.markAllRead();
      setPage(1);
      await fetchPage(1, activeCategory);
      refreshUnread();
    } catch {}
  };

  const handleItemClick = async (item: NotificationMessage) => {
    if (!item.isRead) {
      try {
        await notificationSdk.messages.markRead([item.id]);
        setList(prev => prev.map(m => m.id === item.id ? { ...m, isRead: 1 as const } : m));
        refreshUnread();
      } catch {}
    }
    navigateTo(`/notifications/detail/${item.id}`);
  };

  /** 左滑：标记已读 */
  const handleMarkRead = async (item: NotificationMessage) => {
    setOpenId(null);
    try {
      await notificationSdk.messages.markRead([item.id]);
      setList(prev => prev.map(m => m.id === item.id ? { ...m, isRead: 1 as const } : m));
      refreshUnread();
    } catch {}
  };

  /** 左滑：删除（归档） */
  const handleDelete = async (item: NotificationMessage) => {
    // 先乐观移除，再调接口
    setList(prev => prev.filter(m => m.id !== item.id));
    setTotal(t => Math.max(0, t - 1));
    setOpenId(null);
    try {
      await notificationSdk.messages.archive(item.id);
      if (!item.isRead) refreshUnread();
    } catch {
      // 失败时重新拉取
      fetchPage(1, activeCategory);
    }
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

  // 分类 Tabs 始终≥2 项（全部 + 3 大分类），故必显示
  const hasTabs = true;

  return (
    <div
      className="page-notifications"
      // 点击列表外区域收起展开的 item
      onClick={() => { if (openId !== null) setOpenId(null); }}
    >
      <AppHeader title="消息中心" showBack onBack={() => navigateBack()} />
      {hasTabs && (
        <AppTabs
          mode="multiple"
          tabs={tabs}
          activeIndex={activeTabIndex}
          onChange={handleTabChange}
        />
      )}
      <main className={`page-notifications__content${hasTabs ? ' page-notifications__content--with-tabs' : ''}`}>
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
            <SwipeableItem
              key={item.id}
              item={item}
              openId={openId}
              setOpenId={setOpenId}
              onItemClick={handleItemClick}
              onMarkRead={handleMarkRead}
              onDelete={handleDelete}
              formatTime={formatTime}
            />
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
