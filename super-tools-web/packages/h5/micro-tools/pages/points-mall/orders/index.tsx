/**
 * 兑换记录页
 * Plan: Task 5.6
 */
import React, { useEffect, useState } from 'react';
import { history } from 'umi';
import AppHeader from '../../../components/AppHeader';
import { usePointsMallStore } from '../../../store';
import type { MallOrderStatus } from '../../../types/points';
import './index.less';

const STATUS_TABS: Array<{ key: MallOrderStatus | 'all'; label: string }> = [
  { key: 'all', label: '全部' },
  { key: 'pending', label: '待处理' },
  { key: 'completed', label: '已完成' },
  { key: 'shipping', label: '配送中' },
  { key: 'cancelled', label: '已取消' },
];

const STATUS_ICONS: Record<MallOrderStatus, string> = {
  pending: '⏳', completed: '✅', shipping: '🚚', cancelled: '❌',
};

const OrdersPage: React.FC = () => {
  const orders = usePointsMallStore((s) => s.orders);
  const ordersLoading = usePointsMallStore((s) => s.ordersLoading);
  const fetchOrders = usePointsMallStore((s) => s.fetchOrders);
  const [activeStatus, setActiveStatus] = useState<MallOrderStatus | 'all'>('all');

  useEffect(() => {
    fetchOrders(true, activeStatus);
  }, [fetchOrders, activeStatus]);

  return (
    <div className="page-mall-orders">
      <AppHeader title="兑换记录" showBack onBack={() => history.goBack()} />
      <main className="page-mall-orders__content">
        <div className="page-mall-orders__tabs">
          {STATUS_TABS.map((t) => (
            <span key={t.key}
              className={`page-mall-orders__tab${activeStatus === t.key ? ' is-active' : ''}`}
              onClick={() => setActiveStatus(t.key)}>
              {t.label}
            </span>
          ))}
        </div>

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
            <div className="page-mall-orders__order-cost">消耗：{o.pointsCost} 积分</div>
            <div className="page-mall-orders__order-status">
              {STATUS_ICONS[o.status] || ''} {o.status === 'pending' ? '待处理' : o.status === 'completed' ? '已完成' : o.status === 'shipping' ? '配送中' : '已取消'}
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
