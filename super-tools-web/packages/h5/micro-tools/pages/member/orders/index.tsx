/**
 * 我的订单列表
 *
 * - Tab 筛选：全部 / 待支付 / 已支付 / 已取消
 * - 卡片操作：status=0 → [立即支付] [取消]；其他状态点卡片跳详情
 * - 上拉加载更多（IntersectionObserver）
 */
import React, { useEffect, useState, useCallback, useRef } from 'react';
import { navigateBack, navigateTo } from '@/utils/navigator';
import { safeNavigate } from '../../../utils/safeNavigate';
import { showToast } from '../../../utils/toast';
import { listMyOrders, cancelOrder, createPayment } from '../../../service/payment';
import type { OrderListItem } from '../../../types/order';
import AppHeader from '../../../components/AppHeader';
import AppModal from '../../../components/AppModal';
import './index.less';

type TabKey = 'all' | '0' | '1' | '2';

const TABS: { key: TabKey; label: string; status?: number }[] = [
  { key: 'all', label: '全部' },
  { key: '0', label: '待支付', status: 0 },
  { key: '1', label: '已支付', status: 1 },
  { key: '2', label: '已取消', status: 2 },
];

const STATUS_LABEL: Record<number, string> = {
  0: '待支付',
  1: '已支付',
  2: '已取消',
  3: '已过期',
  4: '已退款',
};
const STATUS_COLOR: Record<number, string> = {
  0: '#faad14',
  1: '#52c41a',
  2: '#999',
  3: '#ff4d4f',
  4: '#722ed1',
};

const OrdersPage: React.FC = () => {
  const [tab, setTab] = useState<TabKey>('all');
  const [list, setList] = useState<OrderListItem[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [cancelModal, setCancelModal] = useState<{ visible: boolean; orderId?: number }>({
    visible: false,
  });
  const sentinelRef = useRef<HTMLDivElement>(null);
  const loadingRef = useRef(false); // 避免 useCallback 闭包过期导致并发请求

  const status = TABS.find((t) => t.key === tab)?.status;

  const fetchPage = useCallback(
    async (p: number, replace: boolean, statusArg?: number) => {
      if (loadingRef.current) return;
      loadingRef.current = true;
      setLoading(true);
      try {
        const res = await listMyOrders({ page: p, pageSize: 10, status: statusArg });
        if (res?.code === 200 && res.data) {
          setList((prev) =>
            replace ? res.data!.list : [...prev, ...res.data!.list],
          );
          setHasMore(p < res.data.totalPages);
          setPage(p);
        }
      } catch (e: any) {
        showToast(e?.message || '加载失败', 'error');
      } finally {
        loadingRef.current = false;
        setLoading(false);
      }
    },
    [],
  );

  // tab 切换 → reload
  useEffect(() => {
    setList([]);
    setPage(1);
    setHasMore(true);
    fetchPage(1, true, status);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  // 上拉加载
  useEffect(() => {
    if (!sentinelRef.current) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loadingRef.current) {
          fetchPage(page + 1, false, status);
        }
      },
      { threshold: 0.1 },
    );
    obs.observe(sentinelRef.current);
    return () => obs.disconnect();
  }, [page, hasMore, status, fetchPage]);

  const handlePay = useCallback(async (orderId: number) => {
    try {
      const payRes = await createPayment(orderId, 'mock');
      if (payRes?.code !== 200 || !payRes.data) {
        throw new Error(payRes?.message || '创建支付失败');
      }
      const url =
        payRes.data.cashierUrl || `/member/cashier?paymentNo=${payRes.data.paymentNo}`;
      safeNavigate(url);
    } catch (e: any) {
      showToast(e?.message || '操作失败', 'error');
    }
  }, []);

  const handleCancel = useCallback(
    async (orderId: number) => {
      try {
        const res = await cancelOrder(orderId);
        if (res?.code !== 200) throw new Error(res?.message || '取消失败');
        showToast('已取消', 'success');
        fetchPage(1, true, status);
      } catch (e: any) {
        showToast(e?.message || '操作失败', 'error');
      }
    },
    [fetchPage, status],
  );

  return (
    <div className="page-orders">
      <AppHeader title="我的订单" showBack onBack={() => navigateTo('/member')} />
      <div className="page-orders__tabs">
        {TABS.map((t) => (
          <div
            key={t.key}
            className={`page-orders__tab ${tab === t.key ? 'page-orders__tab--active' : ''}`}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </div>
        ))}
      </div>

      <main className="page-orders__content">
        {list.map((o) => (
          <div
            key={o.id}
            className="page-orders__card"
            onClick={() => safeNavigate(`/member/orders/${o.id}`)}
          >
            <div className="page-orders__card-head">
              <span className="page-orders__no">{o.orderNo}</span>
              <span
                className="page-orders__status"
                style={{ color: STATUS_COLOR[o.status] }}
              >
                {STATUS_LABEL[o.status]}
              </span>
            </div>
            <div className="page-orders__card-body">
              <div className="page-orders__plan">
                {o.planSnapshot?.name || o.planCode}
                {o.scene === 2 ? '（续费）' : ''}
              </div>
              <div className="page-orders__amount">¥{o.amount}</div>
            </div>
            <div className="page-orders__card-foot">
              <span className="page-orders__time">
                {(o.createdAt || '').replace('T', ' ').slice(0, 16)}
              </span>
              {o.status === 0 && (
                <span
                  className="page-orders__actions"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    className="page-orders__btn page-orders__btn--ghost"
                    onClick={() => setCancelModal({ visible: true, orderId: o.id })}
                  >
                    取消
                  </button>
                  <button
                    className="page-orders__btn page-orders__btn--primary"
                    onClick={() => handlePay(o.id)}
                  >
                    立即支付
                  </button>
                </span>
              )}
            </div>
          </div>
        ))}

        {list.length === 0 && !loading && (
          <div className="page-orders__empty">暂无订单</div>
        )}

        <div ref={sentinelRef} className="page-orders__sentinel">
          {loading ? '加载中...' : hasMore ? '上拉加载更多' : '没有更多了'}
        </div>
      </main>

      <AppModal
        visible={cancelModal.visible}
        title="取消订单"
        content="确认取消此订单？取消后无法恢复"
        confirmText="确认取消"
        cancelText="再想想"
        onConfirm={() => {
          if (cancelModal.orderId) handleCancel(cancelModal.orderId);
          setCancelModal({ visible: false });
        }}
        onCancel={() => setCancelModal({ visible: false })}
        onClose={() => setCancelModal({ visible: false })}
      />
    </div>
  );
};

export default OrdersPage;
