import React, { useState, useEffect, useRef, useCallback } from 'react';
import classNames from 'classnames';
import { getToolsByCategory, type CategoryItem } from '@/utils/toolsData';
import { navigateTo } from '@/utils/navigator';
import { useTabsStore } from '@/store/tabs';
import './index.less';

interface SidebarProps {
  mainRef?: React.RefObject<HTMLDivElement | null>;
  onItemClick?: () => void; // 移动端点击后关闭抽屉
}

const Sidebar: React.FC<SidebarProps> = ({ mainRef, onItemClick }) => {
  const [categories] = useState<CategoryItem[]>(() => getToolsByCategory());
  const [activeCategory, setActiveCategory] = useState<string>('');
  const { activeKey } = useTabsStore();
  const [indicatorTop, setIndicatorTop] = useState(0);
  const [indicatorHeight, setIndicatorHeight] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  // 初始化默认激活第一项
  useEffect(() => {
    if (categories.length > 0 && !activeCategory) {
      setActiveCategory(categories[0].name);
    }
  }, [categories]);

  // 更新指示器位置
  useEffect(() => {
    const activeEl = itemRefs.current.get(activeCategory);
    if (activeEl && listRef.current) {
      const listRect = listRef.current.getBoundingClientRect();
      const itemRect = activeEl.getBoundingClientRect();
      setIndicatorTop(itemRect.top - listRect.top + listRef.current.scrollTop);
      setIndicatorHeight(itemRect.height);
    }
  }, [activeCategory]);

  // 滚动监听：监听 Main 区域滚动，自动更新 active 分类
  useEffect(() => {
    const mainEl = mainRef?.current;
    if (!mainEl) return;

    const handleScroll = () => {
      const scrollTop = mainEl.scrollTop;
      let currentCategory = categories[0]?.name || '';

      categories.forEach((cat) => {
        const anchor = document.getElementById(`category-${encodeURIComponent(cat.name)}`);
        if (anchor) {
          const anchorTop = anchor.offsetTop;
          if (scrollTop >= anchorTop - 80) {
            currentCategory = cat.name;
          }
        }
      });

      setActiveCategory(currentCategory);
    };

    mainEl.addEventListener('scroll', handleScroll, { passive: true });
    return () => mainEl.removeEventListener('scroll', handleScroll);
  }, [mainRef, categories]);

  // 点击分类：滚动到对应锚点
  const handleCategoryClick = useCallback(
    (category: CategoryItem) => {
      setActiveCategory(category.name);
      onItemClick?.();

      // 如果当前不在首页，先跳转到首页
      if (activeKey !== '/') {
        navigateTo('/');
        // 等待首页渲染完成后再滚动
        setTimeout(() => {
          const mainEl = mainRef?.current;
          if (!mainEl) return;
          const anchor = document.getElementById(
            `category-${encodeURIComponent(category.name)}`,
          );
          if (anchor) {
            const anchorRect = anchor.getBoundingClientRect();
            const mainRect = mainEl.getBoundingClientRect();
            mainEl.scrollTo({
              top: mainEl.scrollTop + anchorRect.top - mainRect.top - 16,
              behavior: 'smooth',
            });
          }
        }, 100);
        return;
      }

      const mainEl = mainRef?.current;
      if (!mainEl) return;

      const anchor = document.getElementById(
        `category-${encodeURIComponent(category.name)}`,
      );
      if (anchor) {
        const anchorRect = anchor.getBoundingClientRect();
        const mainRect = mainEl.getBoundingClientRect();
        mainEl.scrollTo({
          top: mainEl.scrollTop + anchorRect.top - mainRect.top - 16,
          behavior: 'smooth',
        });
      }
    },
    [mainRef, onItemClick, activeKey],
  );

  return (
    <div className="sidebar">
      <div className="sidebar__list" ref={listRef}>
        {/* 动画指示器 */}
        <div
          className="sidebar__indicator"
          style={{ top: indicatorTop, height: indicatorHeight }}
        />

        {categories.map((cat) => (
          <div
            key={cat.name}
            ref={(el) => {
              if (el) itemRefs.current.set(cat.name, el);
            }}
            className={classNames('sidebar__item', {
              'sidebar__item--active': activeCategory === cat.name,
            })}
            onClick={() => handleCategoryClick(cat)}
          >
            <span
              className={classNames('iconfont', cat.icon, 'sidebar__item-icon')}
            />
            <span className="sidebar__item-name">{cat.name}</span>
            <span className="sidebar__item-count">{cat.tools.length}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Sidebar;
