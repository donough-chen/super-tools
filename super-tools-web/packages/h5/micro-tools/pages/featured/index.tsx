/**
 * 特色页 Featured
 *
 * 一级页面：双 Tab 模式（特色功能 / 会员专属）
 * 支持点击 Tab 切换和左右滑动手势切换
 * 头部按钮：[agent, search, settings]
 */
import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useHistory } from 'umi';
import { useGlobalStore } from '../../store';
import { getFeaturedTools } from '../../service';
import AppHeader from '../../components/AppHeader';
import AppTabs from '../../components/AppTabs';
import AppTabBar from '../../components/AppTabBar';
import { TAB_BAR_ITEMS } from '../../constants';
import { useSwipe } from '../../hooks/useSwipe';
import type { ToolItem } from '../../store/home';
import './index.less';

const TABS = [
  { key: 'featured', name: '特色功能' },
  { key: 'vip', name: '会员专属' },
];

const FeaturedPage: React.FC = () => {
  const { tabBarMode, activeTabBarKey, setActiveTabBarKey } = useGlobalStore();
  const [activeIndex, setActiveIndex] = useState(0);
  const [list, setList] = useState<ToolItem[]>([]);
  const [loading, setLoading] = useState(false);

  const history = useHistory();

  /** 跟手偏移量（px） */
  const [swipeOffset, setSwipeOffset] = useState(0);
  /** 是否处于过渡动画中 */
  const [isTransitioning, setIsTransitioning] = useState(false);
  /** 切换方向：用于离场/入场动画 */
  const [slideDirection, setSlideDirection] = useState<'left' | 'right' | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  const fetchList = async (type: 'featured' | 'vip') => {
    setLoading(true);
    try {
      const res = await getFeaturedTools(type);
      setList((res?.code === 0 && res.data) ? res.data : []);
    } catch (err) {
      console.error('[Featured] fetch error:', err);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchList(TABS[activeIndex].key as 'featured' | 'vip');
  }, [activeIndex]);

  /** 处理 Tab 切换（兼容点击和滑动） */
  const handleTabChange = useCallback((newIndex: number) => {
    if (newIndex === activeIndex || newIndex < 0 || newIndex >= TABS.length) return;
    const direction = newIndex > activeIndex ? 'left' : 'right';
    setSlideDirection(direction);
    setIsTransitioning(true);
    setActiveIndex(newIndex);

    // 过渡动画结束后重置
    const timer = setTimeout(() => {
      setIsTransitioning(false);
      setSlideDirection(null);
    }, 300);
    return () => clearTimeout(timer);
  }, [activeIndex]);

  const swipeHandlers = useSwipe({
    threshold: 50,
    velocityThreshold: 0.3,
    onSwiping: (offsetX) => {
      // 边界阻尼：到达首尾 Tab 时减弱偏移
      if ((activeIndex === 0 && offsetX > 0) || (activeIndex === TABS.length - 1 && offsetX < 0)) {
        setSwipeOffset(offsetX * 0.3);
      } else {
        setSwipeOffset(offsetX);
      }
    },
    onSwipeLeft: () => {
      handleTabChange(activeIndex + 1);
    },
    onSwipeRight: () => {
      handleTabChange(activeIndex - 1);
    },
    onSwipeEnd: () => {
      setSwipeOffset(0);
    },
  });

  /** 内容区域动态 style：跟手偏移 + 过渡动画 */
  const contentStyle: React.CSSProperties = {
    paddingTop: 'calc(var(--header-height) + var(--tabs-height))',
    transform: isTransitioning
      ? undefined
      : swipeOffset !== 0
        ? `translateX(${swipeOffset}px)`
        : undefined,
    transition: swipeOffset !== 0 ? 'none' : undefined,
  };

  /** 内容区域 class */
  const contentClass = [
    'page-featured__content',
    isTransitioning && slideDirection === 'left' ? 'page-featured__content--slide-left' : '',
    isTransitioning && slideDirection === 'right' ? 'page-featured__content--slide-right' : '',
  ].filter(Boolean).join(' ');

  return (
    <div className="page-featured">
      <AppHeader
        title="特色"
        buttons={[
          { type: 'agent' },
          { type: 'search', onClick: () => history.push('/search') },
          { type: 'settings' },
        ]}
      />

      <AppTabs
        mode="double"
        tabs={TABS}
        activeIndex={activeIndex}
        onChange={handleTabChange}
      />

      <main
        ref={contentRef}
        className={contentClass}
        style={contentStyle}
        {...swipeHandlers}
      >
        {loading ? (
          <div className="page-featured__loading">加载中...</div>
        ) : (
          <div className="page-featured__list">
            {list.map(tool => (
              <div key={tool.id} className="page-featured__item" onClick={() => history.push(tool.url)}>
                <img className="page-featured__icon" src={tool.icon || 'https://via.placeholder.com/80'} alt={tool.name} />
                <span className="page-featured__name">{tool.name}</span>
                {tool.subtitle && <span className="page-featured__subtitle">{tool.subtitle}</span>}
              </div>
            ))}
          </div>
        )}
      </main>

      <AppTabBar
        mode={tabBarMode}
        activeKey={activeTabBarKey}
        items={TAB_BAR_ITEMS}
        onChange={key => {
          setActiveTabBarKey(key);
          history.push(key === 'home' ? '/' : `/${key}`);
        }}
      />
    </div>
  );
};

export default FeaturedPage;
