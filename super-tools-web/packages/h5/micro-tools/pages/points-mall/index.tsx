/**
 * 积分商城首页
 * 模块：积分卡 / 分类导航 / 精选商品双列
 * Plan: Task 5.2
 */
import React, { useEffect, useMemo } from 'react';
import AppHeader from '../../components/AppHeader';
import MallItemCard from '../../components/MallItemCard';
import Countdown from '../../components/Countdown';
import { navigateTo, navigateBack } from '@/utils/navigator';
import { useMemberStore, usePointsMallStore } from '../../store';
import type { MallItemCategory } from '../../types/points';
import './index.less';

const CATEGORIES: Array<{ code: MallItemCategory; name: string; icon: string }> = [
  { code: 'benefit', name: '权益', icon: '🎁' },
  { code: 'coupon', name: '优惠券', icon: '🎫' },
  { code: 'physical', name: '实物', icon: '📦' },
  { code: 'thirdparty', name: '第三方', icon: '🎟️' },
];

const MOCK_FLASH_END = new Date(Date.now() + 24 * 3600 * 1000).toISOString();

const PointsMallPage: React.FC = () => {
  const memberInfo = useMemberStore((s) => s.memberInfo);
  const fetchMemberInfo = useMemberStore((s) => s.fetchMemberInfo);
  const items = usePointsMallStore((s) => s.items);
  const fetchItems = usePointsMallStore((s) => s.fetchItems);

  useEffect(() => {
    fetchMemberInfo();
    fetchItems();
  }, [fetchMemberInfo, fetchItems]);

  const userPoints = memberInfo?.points ?? 0;
  const levelName = memberInfo?.level?.name || '普通用户';

  const flashItems = useMemo(() => {
    const hot = items.filter((it) => it.tags?.includes('hot')).slice(0, 3);
    return hot.length > 0 ? hot : items.slice(0, 3);
  }, [items]);

  const featuredItems = useMemo(() => items.slice(0, 8), [items]);

  return (
    <div className="page-mall">
      <AppHeader
        title="积分商城"
        showBack
        onBack={() => navigateBack()}
        rightSlot={
          <span className="page-mall__orders-link" onClick={() => navigateTo('/points-mall/orders')}>
            兑换记录
          </span>
        }
      />
      <main className="page-mall__content">
        {/* 我的券包入口 */}
        <div className="page-mall__coupons-entry" onClick={() => navigateTo('/points-mall/coupons')}>
          <span className="page-mall__coupons-icon">🎫</span>
          <span className="page-mall__coupons-text">我的券包</span>
          <span className="page-mall__coupons-arrow"></span>
        </div>
        {/* 积分卡 */}
        <div className="page-mall__points-card">
          <div className="page-mall__points-row">
            <div>
              <div className="page-mall__points-label">我的积分</div>
              <div className="page-mall__points-value">{userPoints}</div>
            </div>
            <button className="page-mall__earn-btn" onClick={() => navigateTo('/tasks')}>去赚积分</button>
          </div>
          <div className="page-mall__level-tip">当前 {levelName} · 享受专属折扣</div>
        </div>

        {/* 限时特惠 */}
        {flashItems.length > 0 && (
          <div className="page-mall__section">
            <div className="page-mall__section-title">
              🔥 限时特惠
              <Countdown endAt={MOCK_FLASH_END} prefix="距结束" />
            </div>
            <div className="page-mall__flash-list">
              {flashItems.map((it) => (
                <MallItemCard key={it.id} item={it} userPoints={userPoints}
                  onClick={() => navigateTo(`/points-mall/items/${it.id}`)} />
              ))}
            </div>
          </div>
        )}

        {/* 分类导航 */}
        <div className="page-mall__section">
          <div className="page-mall__section-title">分类</div>
          <div className="page-mall__categories">
            {CATEGORIES.map((c) => (
              <div key={c.code} className="page-mall__category"
                onClick={() => navigateTo(`/points-mall/category/${c.code}`)}
              >
                <div className="page-mall__category-icon">{c.icon}</div>
                <div className="page-mall__category-name">{c.name}</div>
              </div>
            ))}
          </div>
        </div>

        {/* 精选好物 */}
        <div className="page-mall__section">
          <div className="page-mall__section-title">精选好物</div>
          {featuredItems.length === 0 ? (
            <div className="page-mall__empty">🛍️ 商品补货中</div>
          ) : (
            <div className="page-mall__grid">
              {featuredItems.map((it) => (
                <MallItemCard key={it.id} item={it} userPoints={userPoints}
                  onClick={() => navigateTo(`/points-mall/items/${it.id}`)} />
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default PointsMallPage;
