/**
 * 兑换记录页（改用 AppTabs 组件）
 * Plan: Task 5.6 fix
 */
import React, { useEffect, useState } from 'react';
import { navigateBack } from '@/utils/navigator';
import AppHeader from '../../../components/AppHeader';
import AppTabs from '../../../components/AppTabs';
import { usePointsMallStore } from '../../../store';
import type { MallOrderStatus } from '../../../types/points';
import './index.less';

const STATUS_TABS = [
  { key: 'all', name: '全部' },
  { key: 'pending', name: '待处理' },
  { key: 'completed', name: '已完成' },
  { key: 'shipping', name: '配送中' },
  { key: 'cancelled', name: '已取消' },
];

const STATUS_ICONS: Record<MallOrderStatus, string> = {
  pending: '⏳', completed: '✅', shipping: '🚚', cancelled: '❌',
};

const STATUS_TEXT: Record<MallOrderStatus, string> = {
  pending: '待处理', completed: '已完成', shipping: '配送中', cancelled: '已取消',
};

const OrdersPage: React.FC = () => {
  const orders = usePointsMallStore((s) => s.orders);
  const ordersLoading = usePointsMallStore((s) => s.ordersLoading);
  const fetchOrders = usePointsMallStore((s) => s.fetchOrders);
  const [activeIdx, setActiveIdx] = useState(0);

  const activeStatus = STATUS_TABS[activeIdx]?.key as MallOrderStatus | 'all';

  useEffect(() => {
    fetchOrders(true, activeStatus);
  }, [fetchOrders, activeStatus]);

  return (
    <div className="page-mall-orders">
      <AppHeader title="兑换记录" showBack onBack={() => navigateBack()} />

      <AppTabs
        mode="multiple"
        tabs={STATUS_TABS}
        activeIndex={activeIdx}
        onChange={(idx: number) => setActiveIdx(idx)}
      />

      <main className="page-mall-orders__content">
        {ordersLoading && orders.length === 0 && (
          <div className="page-mall-orders__loading">加载中...</div>
        )}
        {!ordersLoading && orders.length === 0 && (
          <div className="page-mall-orders__empty">
            📦 还没有兑换记录
            <div className="page-mall-orders__empty-sub">用积分兑换心仪好礼吧</div>
          </div>
        )}

        {orders.map((o) => (
          <div key={o.id} className="page-mall-orders__order">
            <div className="page-mall-orders__order-row">
              <div className="page-mall-orders__order-name">{o.itemName}</div>
              <div className="page-mall-orders__order-date">{o.createdAt?.slice(0, 10)}</div>
            </div>
            <div className="page-mall-orders__order-no">订单号：{o.orderNo}</div>
            <div className="page-mall-orders__order-cost">消耗：{o.costPoints} 积分</div>
            <div className="page-mall-orders__order-status">
              {STATUS_ICONS[o.status] || ''} {STATUS_TEXT[o.status] || o.status}
            </div>
            {o.trackingInfo && (
              <div className="page-mall-orders__tracking">
                快递：{o.trackingInfo.carrier} {o.trackingInfo.number}
              </div>
            )}
          </div>
        ))}
      </main>
    </div>
  );
};

export default OrdersPage;
