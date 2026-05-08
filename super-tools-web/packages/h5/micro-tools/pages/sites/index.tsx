/**
 * 网站页 Sites
 *
 * 一级页面：多 Tab 模式 + 网站列表
 * 支持点击 Tab 切换和左右滑动手势切换
 * 头部按钮：[agent, search, sort]
 */
import React, { useEffect, useState, useCallback, useRef } from 'react';
import { navigateTo, openUrl } from '@/utils/navigator';
import { useSitesStore, useGlobalStore } from '../../store';
import AppHeader from '../../components/AppHeader';
import AppTabs from '../../components/AppTabs';
import AppTabBar from '../../components/AppTabBar';
import { TAB_BAR_ITEMS } from '../../constants';
import { useSwipe } from '../../hooks/useSwipe';
import './index.less';

const SitesPage: React.FC = () => {
  const { categories, activeTabIndex, sites, loading, fetchCategories, setActiveTab, fetchSites } = useSitesStore();
  const { tabBarMode, sortType } = useGlobalStore();

  /** 跟手偏移量（px） */
  const [swipeOffset, setSwipeOffset] = useState(0);
  /** 是否处于过渡动画中 */
  const [isTransitioning, setIsTransitioning] = useState(false);
  /** 切换方向：用于离场/入场动画 */
  const [slideDirection, setSlideDirection] = useState<'left' | 'right' | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchCategories();
  }, []);

  useEffect(() => {
    if (categories.length > 0) {
      fetchSites(categories[activeTabIndex].id, sortType);
    }
  }, [activeTabIndex, categories, sortType]);

  /** 处理 Tab 切换（兼容点击和滑动） */
  const handleTabChange = useCallback((newIndex: number) => {
    if (newIndex === activeTabIndex || newIndex < 0 || newIndex >= categories.length) return;
    const direction = newIndex > activeTabIndex ? 'left' : 'right';
    setSlideDirection(direction);
    setIsTransitioning(true);
    setActiveTab(newIndex);

    // 过渡动画结束后重置
    const timer = setTimeout(() => {
      setIsTransitioning(false);
      setSlideDirection(null);
    }, 300);
    return () => clearTimeout(timer);
  }, [activeTabIndex, categories.length, setActiveTab]);

  const swipeHandlers = useSwipe({
    threshold: 50,
    velocityThreshold: 0.3,
    onSwiping: (offsetX) => {
      // 边界阻尼：到达首尾 Tab 时减弱偏移
      if ((activeTabIndex === 0 && offsetX > 0) || (activeTabIndex === categories.length - 1 && offsetX < 0)) {
        setSwipeOffset(offsetX * 0.3);
      } else {
        setSwipeOffset(offsetX);
      }
    },
    onSwipeLeft: () => {
      handleTabChange(activeTabIndex + 1);
    },
    onSwipeRight: () => {
      handleTabChange(activeTabIndex - 1);
    },
    onSwipeEnd: () => {
      setSwipeOffset(0);
    },
  });

  /** 内容区域动态 style：跟手偏移 + 过渡动画 */
  const contentStyle: React.CSSProperties = {
    paddingTop: 'calc(var(--header-height) + var(--tabs-height))',
    transform: isTransitioning
      ? undefined // 过渡动画由 CSS class 控制
      : swipeOffset !== 0
        ? `translateX(${swipeOffset}px)`
        : undefined,
    transition: swipeOffset !== 0 ? 'none' : undefined,
  };

  /** 内容区域 class */
  const contentClass = [
    'page-sites__content',
    isTransitioning && slideDirection === 'left' ? 'page-sites__content--slide-left' : '',
    isTransitioning && slideDirection === 'right' ? 'page-sites__content--slide-right' : '',
  ].filter(Boolean).join(' ');

  return (
    <div className="page-sites">
      <AppHeader
        title="网站"
        buttons={[
          { type: 'agent' },
          { type: 'search', onClick: () => navigateTo('/search') },
          { type: 'sort' },
        ]}
      />

      {categories.length > 0 && (
        <AppTabs
          mode="multiple"
          tabs={categories.map(cat => ({ key: cat.id, name: cat.name, icon: cat.icon }))}
          activeIndex={activeTabIndex}
          onChange={handleTabChange}
        />
      )}

      <main
        ref={contentRef}
        className={contentClass}
        style={contentStyle}
        {...swipeHandlers}
      >
        {loading ? (
          <div className="page-sites__loading">加载中...</div>
        ) : (
          <div className="page-sites__list">
            {sites.map(site => (
              <div key={site.id} className="page-sites__item" onClick={() => openUrl(site.url)}>
                <img className="page-sites__icon" src={site.icon || 'https://via.placeholder.com/64'} alt={site.name} />
                <div className="page-sites__info">
                  <span className="page-sites__name">{site.name}</span>
                  <span className="page-sites__count">{site.userCount} 人使用</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      <AppTabBar mode={tabBarMode} items={TAB_BAR_ITEMS} />
    </div>
  );
};

export default SitesPage;
