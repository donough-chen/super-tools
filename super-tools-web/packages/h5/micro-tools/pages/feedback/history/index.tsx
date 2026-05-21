/**
 * 反馈历史页 /feedback/history
 *
 * 功能：
 * - 拉取当前用户的反馈列表（分页）
 * - 触底自动加载更多
 * - 点击卡片跳转详情页
 * - 未登录引导登录
 * - 无数据引导提交
 */
import React, { useEffect, useState, useCallback, useRef } from 'react';
import { navigateTo } from '@/utils/navigator';
import AppHeader from '../../../components/AppHeader';
import { useUserStore } from '../../../store';
import { showToast } from '../../../utils/toast';
import { getMyFeedbackListApi, FeedbackListItem, FeedbackStatus } from '../../../service/feedback';
import './index.less';

const PAGE_SIZE = 20;

const STATUS_LABELS: Record<FeedbackStatus, string> = {
  0: '待处理', 1: '处理中', 2: '已回复', 3: '已关闭',
};

const TYPE_LABELS: Record<string, string> = {
  bug: 'Bug', suggestion: '建议', praise: '表扬', other: '其他',
};

const formatDate = (s: string): string => {
  if (!s) return '';
  try {
    const d = new Date(s);
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${d.getFullYear()}-${m}-${day}`;
  } catch {
    return s.slice(0, 10);
  }
};

const FeedbackHistoryPage: React.FC = () => {
  const isLoggedIn = useUserStore(s => s.isLoggedIn);

  const [list, setList] = useState<FeedbackListItem[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [inited, setInited] = useState(false);
  const loadingRef = useRef(false);

  const fetchPage = useCallback(async (pageNum: number, append: boolean) => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    setLoading(true);
    try {
      const res: any = await getMyFeedbackListApi({ page: pageNum, pageSize: PAGE_SIZE });
      if (res?.code === 200 && res.data) {
        const rows: FeedbackListItem[] = res.data.rows || [];
        setList(prev => append ? [...prev, ...rows] : rows);
        setTotal(res.data.total || 0);
        setHasMore(pageNum * PAGE_SIZE < (res.data.total || 0));
      } else {
        showToast(res?.message || '加载失败', 'error');
      }
    } catch (e: any) {
      showToast(e?.message || '网络错误', 'error');
    } finally {
      setLoading(false);
      setInited(true);
      loadingRef.current = false;
    }
  }, []);

  // 初始化加载
  useEffect(() => {
    if (isLoggedIn) {
      fetchPage(1, false);
    } else {
      setInited(true);
    }
  }, [isLoggedIn, fetchPage]);

  // 触底加载更多
  useEffect(() => {
    const handleScroll = () => {
      if (loadingRef.current || !hasMore || !isLoggedIn) return;
      const scrollTop = window.scrollY;
      const winHeight = window.innerHeight;
      const docHeight = document.documentElement.scrollHeight;
      if (scrollTop + winHeight >= docHeight - 100) {
        const next = page + 1;
        setPage(next);
        fetchPage(next, true);
      }
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [hasMore, isLoggedIn, page, fetchPage]);

  // ==================== 渲染 ====================

  // 未登录
  if (!isLoggedIn) {
    return (
      <div className="page-feedback-history">
        <AppHeader title="反馈历史" showBack />
        <div className="page-feedback-history__empty">
          <div className="page-feedback-history__empty-text">登录后查看您的反馈记录</div>
          <div
            className="page-feedback-history__empty-btn"
            onClick={() => navigateTo('/login')}
          >
            去登录
          </div>
        </div>
      </div>
    );
  }

  // 已登录但无数据
  if (inited && list.length === 0) {
    return (
      <div className="page-feedback-history">
        <AppHeader title="反馈历史" showBack />
        <div className="page-feedback-history__empty">
          <div className="page-feedback-history__empty-icon">📝</div>
          <div className="page-feedback-history__empty-text">暂无反馈记录</div>
          <div
            className="page-feedback-history__empty-btn"
            onClick={() => navigateTo('/feedback')}
          >
            去反馈
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page-feedback-history">
      <AppHeader title={`反馈历史 (${total})`} showBack />
      <div className="page-feedback-history__list">
        {list.map(item => (
          <div
            key={item.id}
            className="page-feedback-history__card"
            onClick={() => navigateTo(`/feedback/detail/${item.id}`)}
          >
            <div className="page-feedback-history__head">
              <span className="page-feedback-history__type">
                {TYPE_LABELS[item.type] || item.type}
              </span>
              <span className={`page-feedback-history__status page-feedback-history__status--${item.status}`}>
                {STATUS_LABELS[item.status]}
              </span>
            </div>
            <div className="page-feedback-history__content">{item.content}</div>
            <div className="page-feedback-history__time">{formatDate(item.createdAt)}</div>
          </div>
        ))}

        {loading && <div className="page-feedback-history__loading">加载中...</div>}
        {!loading && !hasMore && list.length > 0 && (
          <div className="page-feedback-history__nomore">— 没有更多了 —</div>
        )}
      </div>
    </div>
  );
};

export default FeedbackHistoryPage;
