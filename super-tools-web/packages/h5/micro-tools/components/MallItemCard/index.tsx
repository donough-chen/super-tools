/**
 * 商城商品卡片
 * Plan: Task 5.1
 */
import React, { FC } from 'react';
import type { MallItem } from '../../types/points';
import './MallItemCard.less';

export interface MallItemCardProps {
  item: MallItem;
  userPoints?: number;
  onClick?: () => void;
  mode?: 'grid' | 'list';
}

const TAG_LABELS: Record<string, { text: string; color: string, icon: string}> = {
  hot: { text: '热门', color: '#ff4d4f', icon: '🔥'},
  limited: { text: '限量', color: '#fa8c16', icon: '🎟️'},
  levelExclusive: { text: '专属', color: '#722ed1', icon: '🎖️'},
  newArrival: { text: '新品', color: '#13c2c2', icon: '🆕'},
};

const MallItemCard: FC<MallItemCardProps> = ({ item, userPoints, onClick, mode = 'grid' }) => {
  const actualPoints = item.pointsActual ?? item.pointsRequired;
  const hasDiscount = actualPoints < item.pointsRequired;
  const insufficient = userPoints !== undefined && userPoints < actualPoints;

  return (
    <div className={`mall-item-card mall-item-card--${mode}`} onClick={onClick}>
      <div className="mall-item-card__img-wrap">
        <img src={item.images[0]} alt={item.name} className="mall-item-card__img" />
        <div className="mall-item-card__tags">
          {(item.tags || []).slice(0, 2).map((tag) =>
            TAG_LABELS[tag] ? (
              <span key={tag} className="mall-item-card__tag" style={{ background: TAG_LABELS[tag].color }}>
                {TAG_LABELS[tag].icon} {TAG_LABELS[tag].text}
              </span>
            ) : null,
          )}
        </div>
      </div>
      <div className="mall-item-card__name">{item.name}</div>
      <div className="mall-item-card__price-row">
        {hasDiscount && <span className="mall-item-card__original">{item.pointsRequired}</span>}
        <span className={`mall-item-card__points${insufficient ? ' is-insufficient' : ''}`}>
          {actualPoints} 积分
        </span>
      </div>
      {item.exchangedCount !== undefined && (
        <div className="mall-item-card__sold">已兑 {item.exchangedCount} 次</div>
      )}
    </div>
  );
};

export default MallItemCard;
