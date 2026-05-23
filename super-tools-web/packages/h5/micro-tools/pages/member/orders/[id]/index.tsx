/**
 * 订单详情 — Phase 2 升降级版
 *
 * - 显示订单基础信息 + 套餐快照 + 支付流水 + 退款记录
 * - 升降级订单（scene 3/4）额外展示"原套餐 / 折算价值"
 * - 底部按钮按 status 显隐：
 *   0  待支付 → [立即支付] [取消订单]
 *   2  已取消 / 3 已过期 → [重新下单]
 *   1  已支付 / 4 已退款 → 无
 */
import React, { useEffect, useState, useCallback } from 'react';
import { useParams } from 'umi';
import { navigateBack, navigateTo } from '@/utils/navigator';
import { safeNavigate } from '../../../../utils/safeNavigate';
import { showToast } from '../../../../utils/toast';
import { getOrder, cancelOrder } from '../../../../service/payment';
import type { Order } from '../../../../types/order';
import AppHeader from '../../../../components/AppHeader';
import AppModal from '../../../../components/AppModal';
import './index.less';

const STATUS_LABEL: Record<number, string> = {
  0: '待支付',
  1: '已支付',
  2: '已取消',
  3: '已过期',
  4: '已退款',
};
const SCENE_LABEL: Record<number, string> = {
  1: '新购',
  2: '续费',
  3: '升级（差价）',
  4: '降级（剩余价值折算）',
};
const PAY_STATUS: Record<number, { label: string; color: string }> = {
  0: { label: '处理中', color: '#faad14' },
  1: { label: '成功', color: '#52c41a' },
  2: { label: '失败', color: '#ff4d4f' },
  3: { label: '已退款', color: '#722ed1' },
};
const REFUND_STATUS: Record<number, { label: string; color: string }> = {
  0: { label: '处理中', color: '#faad14' },
  1: { label: '退款成功', color: '#1890ff' },
  2: { label: '退款失败', color: '#ff4d4f' },
};

const OrderDetailPage: React.FC = () => {
  const params = useParams<{ id: string }>();
  const orderId = Number(params.id);
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [cancelModal, setCancelModal] = useState(false);

  const fetchDetail = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getOrder(orderId);
      if (res?.code === 200 && res.data) setOrder(res.data);
    } catch (e: any) {
      showToast(e?.message || '加载失败', 'error');
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    if (orderId) fetchDetail();
  }, [fetchDetail, orderId]);

  /** Phase 2: 立即支付改跳 cashier?orderId 让用户选 provider */
  const handlePay = useCallback(() => {
    if (!order) return;
    safeNavigate(`/member/cashier?orderId=${order.id}`);
  }, [order]);

  const handleCancel = useCallback(async () => {
    if (!order) return;
    try {
      const res = await cancelOrder(order.id);
      if (res?.code !== 200) throw new Error(res?.message || '取消失败');
      showToast('已取消', 'success');
      fetchDetail();
    } catch (e: any) {
      showToast(e?.message || '操作失败', 'error');
    }
  }, [order, fetchDetail]);

  return (
    <div className="page-order-detail">
      <AppHeader title="订单详情" showBack onBack={() => navigateTo('/member/orders')} />
      <main className="page-order-detail__content">
        {loading ? (
          <div className="page-order-detail__loading">加载中...</div>
        ) : !order ? (
          <div className="page-order-detail__empty">订单不存在</div>
        ) : (
          <>
            <div className="page-order-detail__status">
              <span className="page-order-detail__status-text">
                {STATUS_LABEL[order.status]}
              </span>
            </div>

            <div className="page-order-detail__card">
              <div className="page-order-detail__row">
                <span>订单号</span>
                <span>{order.orderNo}</span>
              </div>
              <div className="page-order-detail__row">
                <span>套餐</span>
                <span>{order.planSnapshot?.name || order.planCode}</span>
              </div>
              <div className="page-order-detail__row">
                <span>金额</span>
                <span className="page-order-detail__amount">¥{order.amount}</span>
              </div>
              <div className="page-order-detail__row">
                <span>场景</span>
                <span>{SCENE_LABEL[order.scene] || `场景${order.scene}`}</span>
              </div>
              {/* Phase 2: 升降级订单展示原套餐 + 剩余价值 */}
              {(order.scene === 3 || order.scene === 4) && order.sourcePlanCode && (
                <>
                  <div className="page-order-detail__row">
                    <span>原套餐</span>
                    <span>{order.sourcePlanCode}</span>
                  </div>
                  {order.sourceRemainingValue && (
                    <div className="page-order-detail__row">
                      <span>剩余价值</span>
                      <span>¥{order.sourceRemainingValue}</span>
                    </div>
                  )}
                </>
              )}
              <div className="page-order-detail__row">
                <span>创建时间</span>
                <span>{order.createdAt?.replace('T', ' ').slice(0, 19)}</span>
              </div>
              {order.paidAt && (
                <div className="page-order-detail__row">
                  <span>支付时间</span>
                  <span>{order.paidAt.replace('T', ' ').slice(0, 19)}</span>
                </div>
              )}
              {order.cancelledAt && (
                <div className="page-order-detail__row">
                  <span>取消时间</span>
                  <span>{order.cancelledAt.replace('T', ' ').slice(0, 19)}</span>
                </div>
              )}
              {order.expireAt && order.status === 0 && (
                <div className="page-order-detail__row">
                  <span>过期时间</span>
                  <span>{order.expireAt.replace('T', ' ').slice(0, 19)}</span>
                </div>
              )}
            </div>

            {order.payments && order.payments.length > 0 && (
              <div className="page-order-detail__card">
                <div className="page-order-detail__card-title">支付流水</div>
                {order.payments.map((p, i) => (
                  <div key={p.id} className="page-order-detail__pay">
                    <div className="page-order-detail__pay-head">
                      <span className="page-order-detail__pay-no">
                        #{i + 1} {p.paymentNo}
                      </span>
                      <span
                        className="page-order-detail__pay-status"
                        style={{ color: PAY_STATUS[p.status]?.color }}
                      >
                        {PAY_STATUS[p.status]?.label || p.status}
                      </span>
                    </div>
                    <div className="page-order-detail__pay-meta">
                      <span>{p.provider}</span>
                      <span>¥{p.amount}</span>
                      <span>
                        {(p.createdAt || '').replace('T', ' ').slice(0, 19)}
                      </span>
                    </div>
                    {p.status === 2 && p.failedReason && (
                      <div className="page-order-detail__pay-fail">
                        <span className="page-order-detail__pay-fail-label">失败原因</span>
                        <span className="page-order-detail__pay-fail-text">{p.failedReason}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Phase 2: 退款记录卡片 */}
            {order.refunds && order.refunds.length > 0 && (
              <div className="page-order-detail__card">
                <div className="page-order-detail__card-title">退款记录</div>
                {order.refunds.map((r, i) => (
                  <div key={r.id} className="page-order-detail__pay">
                    <div className="page-order-detail__pay-head">
                      <span className="page-order-detail__pay-no">
                        #{i + 1} {r.refundNo}
                      </span>
                      <span
                        className="page-order-detail__pay-status"
                        style={{ color: REFUND_STATUS[r.status]?.color }}
                      >
                        {REFUND_STATUS[r.status]?.label || r.status}
                      </span>
                    </div>
                    <div className="page-order-detail__pay-meta">
                      <span>{r.provider}</span>
                      <span>¥{r.amount}</span>
                      <span>
                        {(r.refundedAt || r.createdAt || '').replace('T', ' ').slice(0, 19)}
                      </span>
                    </div>
                    {r.reason && (
                      <div className="page-order-detail__pay-fail">
                        <span className="page-order-detail__pay-fail-label">退款原因</span>
                        <span className="page-order-detail__pay-fail-text">{r.reason}</span>
                      </div>
                    )}
                    {r.status === 2 && r.failedReason && (
                      <div className="page-order-detail__pay-fail">
                        <span className="page-order-detail__pay-fail-label">失败原因</span>
                        <span className="page-order-detail__pay-fail-text">{r.failedReason}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            <div className="page-order-detail__actions">
              {order.status === 0 && (
                <>
                  <button
                    className="page-order-detail__btn page-order-detail__btn--ghost"
                    onClick={() => setCancelModal(true)}
                  >
                    取消订单
                  </button>
                  <button
                    className="page-order-detail__btn page-order-detail__btn--primary"
                    onClick={handlePay}
                  >
                    立即支付
                  </button>
                </>
              )}
              {(order.status === 2 || order.status === 3) && (
                <button
                  className="page-order-detail__btn page-order-detail__btn--primary"
                  onClick={() => safeNavigate('/member')}
                >
                  重新下单
                </button>
              )}
            </div>
          </>
        )}
      </main>

      <AppModal
        visible={cancelModal}
        title="取消订单"
        content="确认取消此订单？取消后无法恢复"
        confirmText="确认取消"
        cancelText="再想想"
        onConfirm={() => {
          setCancelModal(false);
          handleCancel();
        }}
        onCancel={() => setCancelModal(false)}
        onClose={() => setCancelModal(false)}
      />
    </div>
  );
};

export default OrderDetailPage;
