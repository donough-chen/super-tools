/**
 * 会员服务页 Member（Phase 2 升降级版）
 *
 * 重大变更（vs phase1）：
 *   - 跨套餐不再"灰禁用"，改为"可点击 → previewOrder → 二次确认 modal"
 *   - 二次确认 modal 展示：scene / amount / remainingValue / newExpireAt / reason
 *   - createOrder 返回 needPayment=false 时（scene=4 降级 0 元订单）直接跳订单详情
 *   - createOrder 返回 needPayment=true 时跳收银台让用户选支付通道
 *
 * 4 个场景：
 *   - scene=1 新购：未付费/已过期 → 立即订阅
 *   - scene=2 续费：同套餐 → 立即续费（叠加剩余天数）
 *   - scene=3 升级：跨套餐 + newPrice > remainingValue → 差价订单
 *   - scene=4 降级：跨套餐 + newPrice <= remainingValue → 0 元订单立即开通
 */
import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { navigateBack } from '@/utils/navigator';
import { safeNavigate } from '../../utils/safeNavigate';
import { showToast } from '../../utils/toast';
import { getMemberInfo, getMemberPlans } from '../../service/member';
import { createOrder, previewOrder, listMyOrders } from '../../service/payment';
import type { PaidPlan, OrderPreviewResult, OrderScene } from '../../types/order';
import type { MemberInfo } from '../../types/auth';
import AppHeader from '../../components/AppHeader';
import AppModal from '../../components/AppModal';
import './index.less';

const MemberPage: React.FC = () => {
  const [plans, setPlans] = useState<PaidPlan[]>([]);
  const [memberInfo, setMemberInfo] = useState<MemberInfo | null>(null);
  const [selectedPlanCode, setSelectedPlanCode] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [pendingOrderModal, setPendingOrderModal] = useState<{
    visible: boolean;
    orderNo?: string;
    orderId?: number;
  }>({ visible: false });

  // Phase 2：升降级二次确认 modal
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
        // 默认选当前付费套餐，否则第一个
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

  /**
   * Phase 2 卡片状态规则：
   *   未付费 / 已过期 → all 'available'（点击直接下单）
   *   付费同套餐 → 'current'（点击续费）
   *   付费跨套餐 → 'switchable'（点击 → preview → 二次确认 modal）
   *   永久套餐已开通 → 'lifetime-disabled'（永久不可切换）
   */
  const planState = (plan: PaidPlan): 'available' | 'current' | 'switchable' | 'lifetime-disabled' => {
    if (!currentPaidCode) return 'available';
    if (currentPaidCode === plan.code) return 'current';
    // 当前是永久 → 禁用所有切换（spec § 9.2 永久会员不支持切换）
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

  /** 真正发起下单（scene 1/2 直接走，scene 3/4 经过 preview confirm） */
  const doCreateOrder = useCallback(async (planCode: string) => {
    setSubmitting(true);
    try {
      const orderRes = await createOrder(planCode);
      if (orderRes?.code !== 200 || !orderRes.data) {
        throw new Error(orderRes?.message || '下单失败');
      }
      const { orderId, needPayment, scene, reason } = orderRes.data;

      // scene=4 降级 0 元订单：立即开通会员，直接跳订单详情（不进收银台）
      if (!needPayment) {
        showToast(`${reason || '已开通'}`, 'success');
        safeNavigate(`/member/orders/${orderId}`);
        return;
      }

      // scene 1/2/3：跳收银台让用户选支付通道
      safeNavigate(`/member/cashier?orderId=${orderId}`);
    } catch (e: any) {
      const msg: string = e?.message || e?.errMsg || String(e);
      // 解析后端 400「您有未完成订单 MOxxx」
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

    // 跨套餐：先 preview，弹 modal 二次确认
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

    // 新购 / 续费：直接下单
    await doCreateOrder(selectedPlan.code);
  }, [selectedPlan, selectedState, doCreateOrder]);

  /** 升降级 modal 内容文案 */
  const previewModalText = useMemo(() => {
    const p = previewModal.preview;
    if (!p) return '';
    const expireDate = p.newExpireAt.slice(0, 10);
    if (p.scene === 3) {
      // 升级
      return `从「${p.currentPlanName || '当前套餐'}」升级到「${p.newPlanName}」\n\n${p.reason}\n\n应付：¥${p.amount}\n新到期：${expireDate}（自支付成功起算）`;
    }
    if (p.scene === 4) {
      // 降级 amount=0
      return `从「${p.currentPlanName || '当前套餐'}」降级到「${p.newPlanName}」\n\n${p.reason}\n\n本次无需支付，立即生效\n新到期：${expireDate}`;
    }
    return p.reason;
  }, [previewModal.preview]);

  return (
    <div className="page-member">
      <AppHeader
        title="会员"
        showBack
        onBack={() => navigateBack()}
        rightSlot={
          <span
            className="page-member__orders-link"
            onClick={() => safeNavigate('/member/orders')}
          >
            我的订单
          </span>
        }
      />
      <main className="page-member__content">
        {/* 当前会员状态卡 */}
        <div className="page-member__status">
          {currentPaid?.isPaid ? (
            <>
              <div className="page-member__status-title">
                {currentPaid.planName || currentPaid.planCode || '付费会员'}
              </div>
              <div className="page-member__status-sub">
                {currentPaid.expireAt ? `有效期至 ${currentPaid.expireAt.slice(0, 10)}` : '永久有效'}
                {currentPaid.remainingDays != null && (
                  <>（剩 {currentPaid.remainingDays} 天）</>
                )}
              </div>
            </>
          ) : (
            <>
              <div className="page-member__status-title">尚未开通付费会员</div>
              <div className="page-member__status-sub">订阅享受更多专属权益</div>
            </>
          )}
        </div>

        {/* 套餐列表 */}
        <div className="page-member__plans">
          {plans.map((plan) => {
            const state = planState(plan);
            const klass = ['page-member__plan'];
            if (selectedPlanCode === plan.code) klass.push('page-member__plan--active');
            if (state === 'lifetime-disabled') klass.push('page-member__plan--disabled');
            if (state === 'current') klass.push('page-member__plan--current');
            if (state === 'switchable') klass.push('page-member__plan--switchable');
            return (
              <div
                key={plan.code}
                className={klass.join(' ')}
                onClick={() => state !== 'lifetime-disabled' && setSelectedPlanCode(plan.code)}
              >
                <h3 className="page-member__plan-name">{plan.name}</h3>
                <div className="page-member__plan-price">¥{plan.price}</div>
                {Number(plan.originalPrice) > Number(plan.price) && (
                  <div className="page-member__plan-original">¥{plan.originalPrice}</div>
                )}
                <p className="page-member__plan-desc">
                  {plan.description ||
                    (plan.durationDays === 0 ? '永久' : `${plan.durationDays} 天`)}
                </p>
                {state === 'current' && (
                  <div className="page-member__plan-tag">当前套餐</div>
                )}
                {state === 'switchable' && (
                  <div className="page-member__plan-tag page-member__plan-tag--switchable">
                    可切换
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <button
          className="page-member__subscribe"
          disabled={buttonDisabled}
          onClick={handleSubmit}
        >
          {submitting ? '处理中...' : buttonLabel}
        </button>
      </main>

      {/* 已存在未支付订单的提示 modal */}
      <AppModal
        visible={pendingOrderModal.visible}
        title="存在未完成订单"
        content={`您有一笔未支付的订单 ${pendingOrderModal.orderNo}，请先处理后再下单`}
        confirmText={pendingOrderModal.orderId ? '查看订单' : '知道了'}
        cancelText="关闭"
        onConfirm={() => {
          if (pendingOrderModal.orderId) {
            safeNavigate(`/member/orders/${pendingOrderModal.orderId}`);
          }
          setPendingOrderModal({ visible: false });
        }}
        onCancel={() => setPendingOrderModal({ visible: false })}
        onClose={() => setPendingOrderModal({ visible: false })}
      />

      {/* Phase 2：升降级二次确认 modal */}
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

export default MemberPage;
