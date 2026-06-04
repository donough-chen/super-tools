/**
 * 我的券包页（使用 AppTabs 组件）
 */
import React, { useEffect, useState } from 'react';
import AppHeader from '../../../components/AppHeader';
import AppTabs from '../../../components/AppTabs';
import { navigateBack } from '@/utils/navigator';
import { usePointsMallStore } from '../../../store';
import type { UserCoupon } from '../../../types/points';
import './index.less';

const STATUS_TABS = [
  { key: 'unused', name: '未使用' },
  { key: 'used', name: '已使用' },
  { key: 'expired', name: '已过期' },
];

const CouponsPage: React.FC = () => {
  const coupons = usePointsMallStore((s) => s.coupons);
  const couponsLoading = usePointsMallStore((s) => s.couponsLoading);
  const fetchCoupons = usePointsMallStore((s) => s.fetchCoupons);
  const [activeIdx, setActiveIdx] = useState(0);

  const activeStatus = STATUS_TABS[activeIdx]?.key as 'unused' | 'used' | 'expired';

  useEffect(() => {
    fetchCoupons(true, activeStatus);
  }, [fetchCoupons, activeStatus]);

  const now = new Date();

  const renderCoupon = (c: UserCoupon) => {
    const isExpired = new Date(c.expireAt) <= now;
    const isUsed = c.status === 0;
    const disabled = isUsed || isExpired;

    let discountLabel = '';
    if (c.couponType === 'percent') {
      discountLabel = `${(c.discount * 10).toFixed(1)}折`;
    } else {
      discountLabel = `¥${c.discount}`;
    }

    let thresholdLabel = '';
    if (c.threshold > 0) {
      thresholdLabel = `满${c.threshold}可用`;
    }

    let statusLabel = '';
    if (isUsed) statusLabel = '已使用';
    else if (isExpired) statusLabel = '已过期';

    return (
      <div key={c.id} className={`coupon-card ${disabled ? 'coupon-card--disabled' : ''}`}>
        <div className="coupon-card__left">
          <div className="coupon-card__discount">{discountLabel}</div>
          {thresholdLabel && <div className="coupon-card__threshold">{thresholdLabel}</div>}
        </div>
        <div className="coupon-card__right">
          <div className="coupon-card__code">{c.couponCode}</div>
          <div className="coupon-card__expire">
            有效期至 {c.expireAt.slice(0, 10)}
          </div>
          {statusLabel && <div className="coupon-card__status-badge">{statusLabel}</div>}
        </div>
      </div>
    );
  };

  return (
    <div className="page-coupons">
      <AppHeader title="我的券包" showBack onBack={() => navigateBack()} />

      <AppTabs
        mode="multiple"
        tabs={STATUS_TABS}
        activeIndex={activeIdx}
        onChange={(idx: number) => setActiveIdx(idx)}
      />

      <main className="page-coupons__content">
        {couponsLoading && coupons.length === 0 && (
          <div className="page-coupons__loading">加载中...</div>
        )}
        {!couponsLoading && coupons.length === 0 && (
          <div className="page-coupons__empty">
            🎫 暂无{STATUS_TABS[activeIdx].name}券
            <div className="page-coupons__empty-sub">去积分商城看看有什么好券吧</div>
          </div>
        )}
        {coupons.map(renderCoupon)}
      </main>
    </div>
  );
};

export default CouponsPage;
