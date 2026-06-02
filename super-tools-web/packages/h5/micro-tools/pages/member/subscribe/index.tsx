/**
 * 订阅会员页（原 /member 内容迁移至此）
 *
 * 路由: /member/subscribe
 * 场景: 新购/续费/升级/降级
 *
 * Plan: Task 2.1
 */
import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { navigateTo, navigateBack } from '@/utils/navigator';
import { showToast } from '../../../utils/toast';
import { getMemberInfo, getMemberPlans } from '../../../service/member';
import { createOrder, previewOrder, listMyOrders } from '../../../service/payment';
import type { PaidPlan, OrderPreviewResult } from '../../../types/order';
import type { MemberInfo } from '../../../types/auth';
import AppHeader from '../../../components/AppHeader';
import AppModal from '../../../components/AppModal';
import './index.less';

const SubscribePage: React.FC = () => {
  const [plans, setPlans] = useState<PaidPlan[]>([]);
  const [memberInfo, setMemberInfo] = useState<MemberInfo | null>(null);
  const [selectedPlanCode, setSelectedPlanCode] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [pendingOrderModal, setPendingOrderModal] = useState<{
    visible: boolean;
    orderNo?: string;
    orderId?: number;
  }>({ visible: false });

  const [previewModal, setPreviewModal] = useState<{
    visible: boolean;
    preview?: OrderPreviewResult;
    targetPlanCode?: string;
  }>({ visible: false });

  const fetchAll = useCallback(async () => {
    try {
      const [planRes, memberRes] = await Promise.all([getMemberPlans(), getMemberInfo()]);
      const planList: PaidPlan[] = (planRes?.code === 200 ? planRes.data || [] : []) as PaidPlan[];
      const validPlans = planList
        .filter((p) => p.status === 1)
        .sort((a, b) => a.sort - b.sort);
      setPlans(validPlans);
      setMemberInfo((memberRes?.code === 200 ? memberRes.data : null) as MemberInfo | null);
      if (validPlans.length) {
        const currentCode =
          memberRes?.data?.paid?.isPaid && memberRes.data.paid.planCode
            ? memberRes.data.paid.planCode
            : validPlans[0].code;
        setSelectedPlanCode(currentCode);
      }
    } catch (e: any) {
      showToast(e?.message || '加载失败', 'error');
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const currentPaid = memberInfo?.paid;
  const currentPaidCode = currentPaid?.isPaid ? currentPaid.planCode : null;

  const planState = (plan: PaidPlan): 'available' | 'current' | 'switchable' | 'lifetime-disabled' => {
    if (!currentPaidCode) return 'available';
    if (currentPaidCode === plan.code) return 'current';
    const currentPlan = plans.find((p) => p.code === currentPaidCode);
    if (currentPlan && currentPlan.durationDays === 0) return 'lifetime-disabled';
    return 'switchable';
  };

  const selectedPlan = useMemo(
    () => plans.find((p) => p.code === selectedPlanCode),
    [plans, selectedPlanCode],
  );
  const selectedState = selectedPlan ? planState(selectedPlan) : 'available';

  const buttonLabel = useMemo(() => {
    if (!selectedPlan) return '选择套餐';
    if (selectedState === 'lifetime-disabled') return '永久会员不支持切换';
    if (selectedState === 'current') {
      const days = currentPaid?.remainingDays;
      return `立即续费 ¥${selectedPlan.price}${days != null ? `（剩 ${days} 天）` : ''}`;
    }
    if (selectedState === 'switchable') return `切换到「${selectedPlan.name}」`;
    return `立即订阅 ¥${selectedPlan.price}`;
  }, [selectedPlan, selectedState, currentPaid]);

  const buttonDisabled = !selectedPlan || selectedState === 'lifetime-disabled' || submitting;

  const doCreateOrder = useCallback(async (planCode: string) => {
    setSubmitting(true);
    try {
      const orderRes = await createOrder(planCode);
      if (orderRes?.code !== 200 || !orderRes.data) {
        throw new Error(orderRes?.message || '下单失败');
      }
      const { orderId, needPayment, reason } = orderRes.data;

      if (!needPayment) {
        showToast(`${reason || '已开通'}`, 'success');
        navigateTo(`/member/orders/${orderId}`);
        return;
      }

      navigateTo(`/member/cashier?orderId=${orderId}`);
    } catch (e: any) {
      const msg: string = e?.message || e?.errMsg || String(e);
      const m = msg.match(/未完成订单\s+(\S+)/);
      if (m) {
        try {
          const ordersRes = await listMyOrders({ status: 0, page: 1, pageSize: 5 });
          const target = ordersRes?.data?.list?.find((o: any) => o.orderNo === m[1]);
          setPendingOrderModal({ visible: true, orderNo: m[1], orderId: target?.id });
        } catch {
          setPendingOrderModal({ visible: true, orderNo: m[1] });
        }
        return;
      }
      showToast(msg, 'error');
    } finally {
      setSubmitting(false);
    }
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!selectedPlan || selectedState === 'lifetime-disabled') return;

    if (selectedState === 'switchable') {
      setSubmitting(true);
      try {
        const res = await previewOrder(selectedPlan.code);
        if (res?.code !== 200 || !res.data) {
          throw new Error(res?.message || '预览失败');
        }
        setPreviewModal({
          visible: true,
          preview: res.data,
          targetPlanCode: selectedPlan.code,
        });
      } catch (e: any) {
        showToast(e?.message || '预览失败', 'error');
      } finally {
        setSubmitting(false);
      }
      return;
    }

    await doCreateOrder(selectedPlan.code);
  }, [selectedPlan, selectedState, doCreateOrder]);

  const previewModalText = useMemo(() => {
    const p = previewModal.preview;
    if (!p) return '';
    const expireDate = p.newExpireAt.slice(0, 10);
    if (p.scene === 3) {
      return `从「${p.currentPlanName || '当前套餐'}」升级到「${p.newPlanName}」\n\n${p.reason}\n\n应付：¥${p.amount}\n新到期：${expireDate}（自支付成功起算）`;
    }
    if (p.scene === 4) {
      return `从「${p.currentPlanName || '当前套餐'}」降级到「${p.newPlanName}」\n\n${p.reason}\n\n本次无需支付，立即生效\n新到期：${expireDate}`;
    }
    return p.reason;
  }, [previewModal.preview]);

  return (
    <div className="page-member-subscribe">
      <AppHeader
        title="订阅会员"
        showBack
        onBack={() => navigateBack()}
        rightSlot={
          <span
            className="page-member-subscribe__orders-link"
            onClick={() => navigateTo('/member/orders')}
          >
            我的订单
          </span>
        }
      />
      <main className="page-member-subscribe__content">
        <div className="page-member-subscribe__status">
          {currentPaid?.isPaid ? (
            <>
              <div className="page-member-subscribe__status-title">
                {currentPaid.planName || currentPaid.planCode || '付费会员'}
              </div>
              <div className="page-member-subscribe__status-sub">
                {currentPaid.expireAt ? `有效期至 ${currentPaid.expireAt.slice(0, 10)}` : '永久有效'}
                {currentPaid.remainingDays != null && (
                  <>（剩 {currentPaid.remainingDays} 天）</>
                )}
              </div>
            </>
          ) : (
            <>
              <div className="page-member-subscribe__status-title">尚未开通付费会员</div>
              <div className="page-member-subscribe__status-sub">订阅享受更多专属权益</div>
            </>
          )}
        </div>

        <div className="page-member-subscribe__plans">
          {plans.map((plan) => {
            const state = planState(plan);
            const klass = ['page-member-subscribe__plan'];
            if (selectedPlanCode === plan.code) klass.push('page-member-subscribe__plan--active');
            if (state === 'lifetime-disabled') klass.push('page-member-subscribe__plan--disabled');
            if (state === 'current') klass.push('page-member-subscribe__plan--current');
            if (state === 'switchable') klass.push('page-member-subscribe__plan--switchable');
            return (
              <div
                key={plan.code}
                className={klass.join(' ')}
                onClick={() => state !== 'lifetime-disabled' && setSelectedPlanCode(plan.code)}
              >
                <h3 className="page-member-subscribe__plan-name">{plan.name}</h3>
                <div className="page-member-subscribe__plan-price">¥{plan.price}</div>
                {Number(plan.originalPrice) > Number(plan.price) && (
                  <div className="page-member-subscribe__plan-original">¥{plan.originalPrice}</div>
                )}
                <p className="page-member-subscribe__plan-desc">
                  {plan.description ||
                    (plan.durationDays === 0 ? '永久' : `${plan.durationDays} 天`)}
                </p>
                {state === 'current' && (
                  <div className="page-member-subscribe__plan-tag">当前套餐</div>
                )}
                {state === 'switchable' && (
                  <div className="page-member-subscribe__plan-tag page-member-subscribe__plan-tag--switchable">
                    可切换
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <button
          className="page-member-subscribe__subscribe"
          disabled={buttonDisabled}
          onClick={handleSubmit}
        >
          {submitting ? '处理中...' : buttonLabel}
        </button>
      </main>

      <AppModal
        visible={pendingOrderModal.visible}
        title="存在未完成订单"
        content={`您有一笔未支付的订单 ${pendingOrderModal.orderNo}，请先处理后再下单`}
        confirmText={pendingOrderModal.orderId ? '查看订单' : '知道了'}
        cancelText="关闭"
        onConfirm={() => {
            if (pendingOrderModal.orderId) {
            navigateTo(`/member/orders/${pendingOrderModal.orderId}`);
          }
          setPendingOrderModal({ visible: false });
        }}
        onCancel={() => setPendingOrderModal({ visible: false })}
        onClose={() => setPendingOrderModal({ visible: false })}
      />

      <AppModal
        visible={previewModal.visible}
        title={previewModal.preview?.scene === 3 ? '确认升级' : '确认降级'}
        content={previewModalText}
        confirmText={
          previewModal.preview?.needPayment
            ? `去支付 ¥${previewModal.preview?.amount}`
            : '确认（无需支付）'
        }
        cancelText="再想想"
        onConfirm={() => {
          const code = previewModal.targetPlanCode;
          setPreviewModal({ visible: false });
          if (code) doCreateOrder(code);
        }}
        onCancel={() => setPreviewModal({ visible: false })}
        onClose={() => setPreviewModal({ visible: false })}
      />
    </div>
  );
};

export default SubscribePage;
