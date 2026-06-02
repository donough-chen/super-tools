/**
 * 商城分类列表页
 * Plan: Task 5.3
 */
import React, { useEffect, useMemo } from 'react';
import { useParams } from 'umi';
import AppHeader from '../../../components/AppHeader';
import MallItemCard from '../../../components/MallItemCard';
import { navigateTo, navigateBack } from '@/utils/navigator';
import { useMemberStore, usePointsMallStore } from '../../../store';
import type { MallItemCategory } from '../../../types/points';
import './[code].less';

const CATEGORY_NAMES: Record<string, string> = {
  benefit: '权益', coupon: '优惠券', physical: '实物', thirdparty: '第三方',
};

const CategoryPage: React.FC = () => {
  const { code } = useParams<{ code: string }>();
  const memberInfo = useMemberStore((s) => s.memberInfo);
  const items = usePointsMallStore((s) => s.items);
  const fetchItems = usePointsMallStore((s) => s.fetchItems);

  useEffect(() => {
    fetchItems(true, code as MallItemCategory);
  }, [fetchItems, code]);

  const filtered = useMemo(() => items.filter((it) => it.category === code), [items, code]);
  const userPoints = memberInfo?.points ?? 0;

  return (
    <div className="page-mall-category">
      <AppHeader title={CATEGORY_NAMES[code] || '商品分类'} showBack onBack={() => navigateBack()} />
      <main className="page-mall-category__content">
        {filtered.length === 0 ? (
          <div className="page-mall-category__empty">📦 该分类暂无商品</div>
        ) : (
          <div className="page-mall-category__grid">
            {filtered.map((it) => (
              <MallItemCard key={it.id} item={it} userPoints={userPoints}
                onClick={() => navigateTo(`/points-mall/items/${it.id}`)} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default CategoryPage;
