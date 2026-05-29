/**
 * 商品详情页
 * Plan: Task 5.4
 */
import React, { useEffect, useState } from 'react';
import { history, useParams } from 'umi';
import AppHeader from '../../../components/AppHeader';
import AppModal from '../../../components/AppModal';
import { showToast } from '../../../utils/toast';
import { safeNavigate } from '../../../utils/safeNavigate';
import { useMemberStore, usePointsMallStore } from '../../../store';
import type { MallItem } from '../../../types/points';
import './[id].less';

const ItemDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const itemId = Number(id);
  const memberInfo = useMemberStore((s) => s.memberInfo);
  const fetchMemberInfo = useMemberStore((s) => s.fetchMemberInfo);
  const fetchItemDetail = usePointsMallStore((s) => s.fetchItemDetail);
  const exchangeAction = usePointsMallStore((s) => s.exchange);
  const exchanging = usePointsMallStore((s) => s.exchanging);

  const [item, setItem] = useState<MallItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [imgIndex, setImgIndex] = useState(0);

  useEffect(() => {
    fetchMemberInfo();
    fetchItemDetail(itemId).then((it) => { setItem(it); setLoading(false); });
  }, [itemId, fetchMemberInfo, fetchItemDetail]);

  if (loading) {
    return (
      <div className="page-item-detail">
        <AppHeader title="商品详情" showBack onBack={() => history.goBack()} />
        <div className="page-item-detail__loading">加载中...</div>
      </div>
    );
  }
  if (!item) {
    return (
      <div className="page-item-detail">
        <AppHeader title="商品详情" showBack onBack={() => history.goBack()} />
        <div className="page-item-detail__empty">商品不存在或已下架</div>
      </div>
    );
  }

  const userPoints = memberInfo?.points ?? 0;
  const actualPoints = item.pointsActual ?? item.pointsRequired;
  const hasDiscount = actualPoints < item.pointsRequired;
  const discountAmount = item.pointsRequired - actualPoints;

  const checkBeforeExchange = (): { ok: boolean; reason?: string } => {
    if (userPoints < actualPoints) {
      return { ok: false, reason: `积分不足，还差 ${actualPoints - userPoints} 积分` };
    }
    if (item.exclusiveLevel && memberInfo?.level?.code !== item.exclusiveLevel) {
      return { ok: false, reason: `该商品需要 ${item.exclusiveLevel} 会员` };
    }
    if (item.monthlyLimit !== undefined && item.monthlyUsed !== undefined && item.monthlyUsed >= item.monthlyLimit) {
      return { ok: false, reason: `本月已达兑换上限（${item.monthlyLimit} 次）` };
    }
    if (item.stock !== undefined && item.stock <= 0) {
      return { ok: false, reason: '商品已售罄' };
    }
    return { ok: true };
  };

  const handleExchangeClick = () => {
    const check = checkBeforeExchange();
    if (!check.ok) { showToast(check.reason || '无法兑换', 'error'); return; }
    setConfirmVisible(true);
  };

  const handleConfirm = async () => {
    setConfirmVisible(false);
    try {
      const result = await exchangeAction(itemId);
      if (result) {
        safeNavigate(`/points-mall/exchange-success?orderId=${result.orderId}&itemId=${itemId}`);
      }
    } catch (e: any) {
      showToast(e?.message || '兑换失败', 'error');
    }
  };

  const confirmContent = (
    <div className="page-item-detail__confirm">
      <div className="page-item-detail__confirm-row"><span>商品</span><span>{item.name}</span></div>
      {hasDiscount && (
        <>
          <div className="page-item-detail__confirm-row">
            <span>原价</span><span style={{ textDecoration: 'line-through' }}>{item.pointsRequired} 积分</span>
          </div>
          <div className="page-item-detail__confirm-row">
            <span>等级折扣</span><span>-{discountAmount} 积分</span>
          </div>
        </>
      )}
      <div className="page-item-detail__confirm-row page-item-detail__confirm-row--main">
        <span>实付</span><span>{actualPoints} 积分</span>
      </div>
      <div className="page-item-detail__confirm-row">
        <span>兑换后余额</span><span>{userPoints - actualPoints} 积分</span>
      </div>
      <div className="page-item-detail__confirm-warn">⚠️ 虚拟商品兑换后不支持退款</div>
    </div>
  );

  return (
    <div className="page-item-detail">
      <AppHeader title="商品详情" showBack onBack={() => history.goBack()} />
      <main className="page-item-detail__content">
        {/* 主图 */}
        <div className="page-item-detail__images">
          <img className="page-item-detail__image" src={item.images[imgIndex] || item.images[0]} alt={item.name} />
          {item.images.length > 1 && (
            <div className="page-item-detail__indicator">
              {item.images.map((_, i) => (
                <span key={i} className={`page-item-detail__dot${i === imgIndex ? ' is-active' : ''}`}
                  onClick={() => setImgIndex(i)} />
              ))}
            </div>
          )}
        </div>

        <div className="page-item-detail__title-block">
          <div className="page-item-detail__title">{item.name}</div>
          <div className="page-item-detail__price-row">
            {hasDiscount && <span className="page-item-detail__original">{item.pointsRequired} 积分</span>}
            <span className="page-item-detail__points">{actualPoints} 积分</span>
          </div>
          {item.exchangedCount !== undefined && (
            <div className="page-item-detail__sold">已兑换 {item.exchangedCount} 次</div>
          )}
        </div>

        <div className="page-item-detail__section">
          <div className="page-item-detail__section-title">商品说明</div>
          <div className="page-item-detail__desc">{item.description || '暂无详细说明'}</div>
          {item.monthlyLimit !== undefined && (
            <div className="page-item-detail__limit">
              每月最多兑换 {item.monthlyLimit} 次
              {item.monthlyUsed !== undefined && `，已兑 ${item.monthlyUsed} 次`}
            </div>
          )}
        </div>

        <div className="page-item-detail__section">
          <div className="page-item-detail__section-title">兑换须知</div>
          <div className="page-item-detail__desc">虚拟商品兑换后不支持退款，请确认后兑换</div>
        </div>
      </main>

      <div className="page-item-detail__footer">
        <button className="page-item-detail__btn" disabled={exchanging} onClick={handleExchangeClick}>
          {exchanging ? '兑换中...' : `立即兑换 ${actualPoints} 积分`}
        </button>
      </div>

      <AppModal visible={confirmVisible} title="确认兑换" content={confirmContent}
        confirmText="确认兑换" cancelText="再想想"
        onConfirm={handleConfirm} onCancel={() => setConfirmVisible(false)} onClose={() => setConfirmVisible(false)} />
    </div>
  );
};

export default ItemDetailPage;
