/**
 * 兑换成功页
 * Plan: Task 5.5
 */
import React, { useEffect, useMemo, useState } from 'react';
import { history, useLocation } from 'umi';
import AppHeader from '../../../components/AppHeader';
import MallItemCard from '../../../components/MallItemCard';
import { safeNavigate } from '../../../utils/safeNavigate';
import { useMemberStore, usePointsMallStore } from '../../../store';
import type { MallItem } from '../../../types/points';
import './index.less';

const useQuery = () => {
  const { search } = useLocation();
  return useMemo(() => new URLSearchParams(search), [search]);
};

const ExchangeSuccessPage: React.FC = () => {
  const query = useQuery();
  const itemId = Number(query.get('itemId'));
  const orderId = query.get('orderId');

  const memberInfo = useMemberStore((s) => s.memberInfo);
  const items = usePointsMallStore((s) => s.items);
  const fetchItems = usePointsMallStore((s) => s.fetchItems);
  const fetchItemDetail = usePointsMallStore((s) => s.fetchItemDetail);
  const [item, setItem] = useState<MallItem | null>(null);

  useEffect(() => {
    fetchItems();
    if (itemId) fetchItemDetail(itemId).then(setItem);
  }, [itemId, fetchItems, fetchItemDetail]);

  const userPoints = memberInfo?.points ?? 0;

  const recommendations = useMemo(() => {
    return items
      .filter((it) => {
        const p = it.pointsActual ?? it.pointsRequired;
        return p > userPoints && p - userPoints < 2000;
      })
      .slice(0, 2);
  }, [items, userPoints]);

  return (
    <div className="page-success">
      <AppHeader title="兑换成功" showBack onBack={() => history.goBack()} />
      <main className="page-success__content">
        <div className="page-success__hero">
          <div className="page-success__icon">🎉</div>
          <div className="page-success__title">兑换成功！</div>
          {item && (
            <>
              <div className="page-success__item-name">{item.name}</div>
              <div className="page-success__item-desc">已存入我的卡包</div>
            </>
          )}
          {orderId && <div className="page-success__order">订单号：{orderId}</div>}
          <div className="page-success__points">
            消耗积分：-{item ? (item.pointsActual ?? item.pointsRequired) : '?'}
          </div>
          <div className="page-success__remain">剩余积分：{userPoints}</div>
        </div>

        <div className="page-success__actions">
          <button className="page-success__btn" onClick={() => safeNavigate('/points-mall/orders')}>
            查看我的订单
          </button>
          <button className="page-success__btn page-success__btn--secondary" onClick={() => safeNavigate('/points-mall')}>
            返回商城
          </button>
        </div>

        {recommendations.length > 0 && (
          <div className="page-success__recommend">
            <div className="page-success__recommend-title">— 顺便看看 —</div>
            <div className="page-success__recommend-grid">
              {recommendations.map((it) => (
                <MallItemCard key={it.id} item={it} userPoints={userPoints}
                  onClick={() => safeNavigate(`/points-mall/items/${it.id}`)} />
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default ExchangeSuccessPage;
