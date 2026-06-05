/**
 * 收银台 Cashier — Phase 2 多通道版
 *
 * 入参（两种）：
 *   - ?orderId=N：从 member 页跳过来，让用户选支付通道 → createPayment
 *   - ?paymentNo=MPxxx：已创建 payment，直接进入支付流程
 *
 * 流程：
 *   - 加载 enabled providers（system_configs.payment.enabled_providers）
 *   - mock：3 按钮（成功/失败/等待回调）+ 倒计时（与 phase1 一致）
 *   - alipay：1 按钮"去支付宝支付" → 跳 cashierUrl 外链 + 提示用户支付完跳回订单详情
 */
import React, { useEffect, useState, useCallback, useRef } from 'react';
// @ts-ignore
import { history } from 'umi';
import { navigate, navigateBack, navigateTo } from '@/utils/navigator';
import { showToast } from '../../../utils/toast';
import {
  getPaymentStatus, getOrder, mockNotify,
  createPayment, getEnabledPaymentProviders,
} from '../../../service/payment';
import { getAvailableCoupons } from '../../../service/coupon';
import type { Order, Payment, PaymentProvider } from '../../../types/order';
import type { AvailableCoupon } from '../../../service/coupon';
import AppHeader from '../../../components/AppHeader';
import AppModal from '../../../components/AppModal';
import './index.less';

const PROVIDER_LABELS: Record<PaymentProvider, string> = {
  mock: '微信支付（开发期 Mock）',
  alipay: '支付宝（沙箱）',
};

const CashierPage: React.FC = () => {
  const search = new URLSearchParams(history.location.search);
  const initialPaymentNo = search.get('paymentNo') || '';
  const orderIdQuery = Number(search.get('orderId') || 0);

  const [paymentNo, setPaymentNo] = useState<string>(initialPaymentNo);
  const [payment, setPayment] = useState<Payment | null>(null);
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [confirmModal, setConfirmModal] = useState<{
    visible: boolean;
    type?: 'success' | 'failed';
  }>({ visible: false });
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const [polling, setPolling] = useState(false);
  const pollTimerRef = useRef<any>(null);

  // 优惠券相关状态
  const [coupons, setCoupons] = useState<AvailableCoupon[]>([]);
  const [bestCoupon, setBestCoupon] = useState<AvailableCoupon | null>(null);
  const [selectedCoupon, setSelectedCoupon] = useState<AvailableCoupon | null>(null);

  // Phase 2：provider 选择
  const [providers, setProviders] = useState<PaymentProvider[]>(['mock']);
  const [selectedProvider, setSelectedProvider] = useState<PaymentProvider>('mock');

  /**
   * 初始化加载：
   *   - 有 paymentNo：直接拉 payment + order（phase1 路径）
   *   - 仅 orderId：拉 order，不创建 payment（等用户选完 provider 再 createPayment）
   */
  const fetchAll = useCallback(async () => {
    try {
      // 加载启用的 provider 列表
      const provRes = await getEnabledPaymentProviders();
      if (provRes?.code === 200 && provRes.data?.providers?.length) {
        setProviders(provRes.data.providers);
        setSelectedProvider(provRes.data.providers[0]);
      }

      if (paymentNo) {
        const payRes = await getPaymentStatus(paymentNo);
        if (payRes?.code !== 200 || !payRes.data) {
          throw new Error(payRes?.message || '支付不存在');
        }
        setPayment(payRes.data);
        const orderRes = await getOrder(payRes.data.orderId);
        if (orderRes?.code === 200 && orderRes.data) setOrder(orderRes.data);
      } else if (orderIdQuery > 0) {
        // 仅 orderId 模式：拉订单信息，等用户选 provider
        const orderRes = await getOrder(orderIdQuery);
        if (orderRes?.code !== 200 || !orderRes.data) {
          throw new Error(orderRes?.message || '订单不存在');
        }
        setOrder(orderRes.data);
        // 如果订单已支付，直接跳订单详情
        if (orderRes.data.status === 1) {
          showToast('订单已支付', 'success');
          navigateTo(`/member/orders/${orderRes.data.id}`);
          return;
        }
      } else {
        throw new Error('缺少 paymentNo 或 orderId 参数');
      }
    } catch (e: any) {
      showToast(e?.message || '加载失败', 'error');
    } finally {
      setLoading(false);
    }
  }, [paymentNo, orderIdQuery]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // 加载可用优惠券
  useEffect(() => {
    if (!order || order.status !== 0) return;
    const loadCoupons = async () => {
      try {
        const res = await getAvailableCoupons(Number(order.amount));
        if (res?.code === 200 && res.data) {
          setCoupons(res.data.list || []);
          setBestCoupon(res.data.bestCoupon || null);
          // 自动选择最佳优惠券
          if (res.data.bestCoupon) {
            setSelectedCoupon(res.data.bestCoupon);
          }
        }
      } catch (e: any) {
        // 获取优惠券失败不影响主流程
        console.warn('加载优惠券失败:', e?.message);
      }
    };
    loadCoupons();
  }, [order]);

  // 倒计时（基于订单 expireAt）
  useEffect(() => {
    if (!order?.expireAt) return;
    const tick = () => {
      const remain = Math.floor(
        (new Date(order.expireAt).getTime() - Date.now()) / 1000,
      );
      setSecondsLeft(Math.max(0, remain));
      if (remain <= 0) {
        showToast('订单已过期', 'error');
        navigateTo(`/member/orders/${order.id}`);
      }
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [order]);

  /** 用户选完 provider 点"去支付"：先 createPayment 再跳转 */
  const handlePay = useCallback(async () => {
    if (!order || submitting) return;
    setSubmitting(true);
    try {
      const res = await createPayment(
        order.id,
        selectedProvider,
        selectedCoupon?.id,
      );
      if (res?.code !== 200 || !res.data) {
        throw new Error(res?.message || '创建支付失败');
      }
      const { paymentNo: newPaymentNo, cashierUrl } = res.data;
      setPaymentNo(newPaymentNo);

      if (selectedProvider === 'alipay') {
        // alipay：跳转支付宝沙箱网关（外链）
        if (!cashierUrl) {
          throw new Error('缺少支付宝跳转地址');
        }
        showToast('正在跳转支付宝...', 'success');
        window.location.href = cashierUrl;
        return;
      }

      // mock：刷新当前页（让 paymentNo 生效，进入 mock 模拟流程）
      const newPayRes = await getPaymentStatus(newPaymentNo);
      if (newPayRes?.code === 200 && newPayRes.data) setPayment(newPayRes.data);
    } catch (e: any) {
      showToast(e?.message || '创建支付失败', 'error');
    } finally {
      setSubmitting(false);
    }
  }, [order, selectedProvider, selectedCoupon, submitting]);


  /** Mock：模拟支付成功/失败 */
  const handleMock = useCallback(
    async (type: 'success' | 'failed') => {
      if (!payment) return;
      const amountNum = Number(payment.amount);
      if (!Number.isFinite(amountNum) || amountNum <= 0) {
        showToast('支付金额异常，请刷新重试', 'error');
        return;
      }
      setSubmitting(true);
      try {
        const body: {
          paymentNo: string;
          amount: number;
          status?: 'success' | 'failed';
          failReason?: string;
        } = { paymentNo: payment.paymentNo, amount: amountNum };
        if (type === 'failed') {
          body.status = 'failed';
          body.failReason = '用户主动取消';
        }
        const res = await mockNotify(body);
        if (res?.code !== 200) throw new Error(res?.message || '回调失败');
        showToast(type === 'success' ? '支付成功' : '支付已取消', 'success');
        navigateTo(`/member/orders/${payment.orderId}`);
      } catch (e: any) {
        showToast(e?.message || '操作失败', 'error');
      } finally {
        setSubmitting(false);
      }
    },
    [payment],
  );

  const handleWait = useCallback(() => {
    if (!payment || polling) return;
    setPolling(true);
    let count = 0;
    pollTimerRef.current = setInterval(async () => {
      count += 1;
      try {
        const res = await getPaymentStatus(payment.paymentNo);
        if (res?.data?.status === 1) {
          clearInterval(pollTimerRef.current);
          setPolling(false);
          showToast('收到支付回调，正在跳转', 'success');
          navigateTo(`/member/orders/${payment.orderId}`);
          return;
        }
        if (res?.data?.status === 2) {
          clearInterval(pollTimerRef.current);
          setPolling(false);
          showToast('支付失败', 'error');
          navigateTo(`/member/orders/${payment.orderId}`);
          return;
        }
      } catch {
        /* ignore */
      }
      if (count >= 10) {
        clearInterval(pollTimerRef.current);
        setPolling(false);
        showToast('暂未收到回调，可手动操作');
      }
    }, 3000);
  }, [payment, polling]);

  useEffect(
    () => () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    },
    [],
  );

  const fmtCountdown = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  };

  // 是否已创建 payment（决定渲染 provider 选择 vs mock 操作按钮）
  const hasPayment = !!payment;
  const isMock = payment?.provider === 'mock';

  return (
    <div className="page-cashier">
      <AppHeader title="收银台" showBack onBack={() => navigateBack()} />
      <main className="page-cashier__content">
        {loading ? (
          <div className="page-cashier__loading">加载中...</div>
        ) : !order ? (
          <div className="page-cashier__empty">订单信息不存在</div>
        ) : (
          <>
            <div className="page-cashier__card">
              <div className="page-cashier__row">
                <span>订单号</span>
                <span>{order.orderNo || '-'}</span>
              </div>
              <div className="page-cashier__row">
                <span>套餐</span>
                <span>{order.planSnapshot?.name || order.planCode || '-'}</span>
              </div>
              <div className="page-cashier__row">
                <span>金额</span>
                <span className="page-cashier__amount">¥{order.amount}</span>
              </div>
              {selectedCoupon && (
                <div className="page-cashier__row">
                  <span>优惠券</span>
                  <span className="page-cashier__coupon">-¥{selectedCoupon.discountAmount}（{selectedCoupon.couponType === 'fixed' ? '满减券' : '折扣券'}）</span>
                </div>
              )}
              {selectedCoupon && (
                <div className="page-cashier__row">
                  <span>实付金额</span>
                  <span className="page-cashier__amount page-cashier__final-amount">¥{Math.max(0, Number(order.amount) - selectedCoupon.discountAmount).toFixed(2)}</span>
                </div>
              )}
              {order.scene === 3 && (
                <div className="page-cashier__row">
                  <span>场景</span>
                  <span>升级（差价订单）</span>
                </div>
              )}
            </div>

            {/* 优惠券选择 */}
            {coupons.length > 0 && (
              <div className="page-cashier__card">
                <div className="page-cashier__section-title">优惠券（{coupons.length} 张可用）</div>
                {coupons.map((coupon) => (
                  <label key={coupon.id} className="page-cashier__coupon-item">
                    <input
                      type="radio"
                      name="coupon"
                      checked={selectedCoupon?.id === coupon.id}
                      onChange={() => setSelectedCoupon(
                        selectedCoupon?.id === coupon.id ? null : coupon
                      )}
                    />
                    <div className="page-cashier__coupon-info">
                      <span className="page-cashier__coupon-discount">
                        {coupon.couponType === 'fixed' ? `¥${coupon.discountAmount}` : `${(Number(coupon.discount) * 10).toFixed(1)}折`}
                      </span>
                      <span className="page-cashier__coupon-threshold">
                        {coupon.threshold > 0 ? `满${coupon.threshold}可用` : '无门槛'}
                      </span>
                      <span className="page-cashier__coupon-expire">
                        过期：{new Date(coupon.expireAt).toLocaleDateString()}
                      </span>
                    </div>
                  </label>
                ))}
                {bestCoupon && selectedCoupon?.id === bestCoupon.id && (
                  <div className="page-cashier__coupon-tip">已自动选择最优优惠券</div>
                )}
              </div>
            )}

            {/* 未创建 payment：显示 provider 单选 */}
            {!hasPayment && (
              <div className="page-cashier__card">
                <div className="page-cashier__section-title">选择支付方式</div>
                {providers.map((prov) => (
                  <label key={prov} className="page-cashier__provider">
                    <input
                      type="radio"
                      name="provider"
                      value={prov}
                      checked={selectedProvider === prov}
                      onChange={() => setSelectedProvider(prov)}
                    />
                    <span>{PROVIDER_LABELS[prov] || prov}</span>
                  </label>
                ))}
              </div>
            )}

            {secondsLeft != null && secondsLeft > 0 && (
              <div className="page-cashier__countdown">
                ⏱️ 剩余支付时间：{fmtCountdown(secondsLeft)}
              </div>
            )}

            {/* 未创建 payment：显示"去支付"按钮 */}
            {!hasPayment && (
              <div className="page-cashier__actions">
                <button
                  className="page-cashier__btn page-cashier__btn--success"
                  disabled={submitting}
                  onClick={handlePay}
                >
                  {submitting
                    ? '处理中...'
                    : selectedProvider === 'alipay'
                      ? '🅰️ 去支付宝支付'
                      : (selectedCoupon
                        ? `去支付 ¥${Math.max(0, Number(order.amount) - selectedCoupon.discountAmount).toFixed(2)}（已减¥${selectedCoupon.discountAmount}）`
                        : `去支付 ¥${order.amount}`)}
                </button>
              </div>
            )}

            {/* 已创建 payment + mock：3 个模拟按钮 */}
            {hasPayment && isMock && (
              <div className="page-cashier__actions">
                <button
                  className="page-cashier__btn page-cashier__btn--success"
                  disabled={submitting || polling}
                  onClick={() => setConfirmModal({ visible: true, type: 'success' })}
                >
                  ✅ 模拟支付成功
                </button>
                <button
                  className="page-cashier__btn page-cashier__btn--failed"
                  disabled={submitting || polling}
                  onClick={() => setConfirmModal({ visible: true, type: 'failed' })}
                >
                  ❌ 模拟支付失败
                </button>
                <button
                  className="page-cashier__btn page-cashier__btn--wait"
                  disabled={submitting || polling}
                  onClick={handleWait}
                >
                  {polling ? '⏳ 等待回调中...' : '⏳ 等待回调（30s 内）'}
                </button>
              </div>
            )}

            {/* 已创建 payment + alipay：等待回调（用户在另一个 tab 完成支付） */}
            {hasPayment && !isMock && (
              <div className="page-cashier__actions">
                <button
                  className="page-cashier__btn page-cashier__btn--wait"
                  disabled={polling}
                  onClick={handleWait}
                >
                  {polling ? '⏳ 等待回调中...' : '⏳ 检查支付结果'}
                </button>
              </div>
            )}

            {!hasPayment && (
              <div className="page-cashier__hint">
                ℹ️ 选择支付方式后点击"去支付"
              </div>
            )}
            {hasPayment && isMock && (
              <div className="page-cashier__hint">
                ⚠️ 当前为开发期 Mock 支付，生产环境将切换为真实通道
              </div>
            )}
          </>
        )}
      </main>

      <AppModal
        visible={confirmModal.visible}
        title={
          confirmModal.type === 'success' ? '确认模拟支付成功' : '确认模拟支付失败'
        }
        content={
          confirmModal.type === 'success'
            ? '将触发订单开通会员 + 三条通知（支付成功/套餐开通/积分变动）'
            : '订单将保持待支付状态，可重新尝试支付'
        }
        confirmText="确认"
        cancelText="再想想"
        onConfirm={() => {
          const t = confirmModal.type;
          setConfirmModal({ visible: false });
          if (t) handleMock(t);
        }}
        onCancel={() => setConfirmModal({ visible: false })}
        onClose={() => setConfirmModal({ visible: false })}
      />
    </div>
  );
};

export default CashierPage;
