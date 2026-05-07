/**
 * 特色页 Featured（重构版）
 *
 * 一级页面：双 Tab — 特色功能 / 会员专属
 * 接入新后端：/api/tools/feature 和 /api/tools/member
 */
import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useHistory } from 'umi';
import { useGlobalStore } from '../../store';
import { useToolClick } from '../../hooks/useToolClick';
import { getFeatureTools, getMemberTools } from '../../service/tool';
import AppHeader from '../../components/AppHeader';
import AppTabs from '../../components/AppTabs';
import AppTabBar from '../../components/AppTabBar';
import AppModal from '../../components/AppModal';
import { TAB_BAR_ITEMS } from '../../constants';
import { useSwipe } from '../../hooks/useSwipe';
import type { Tool } from '../../types/tool';
import { resolveIcon } from '../../utils/icon';
import './index.less';

const TABS = [
  { key: 'feature', name: '特色功能' },
  { key: 'member', name: '会员专属' },
];

const FeaturedPage: React.FC = () => {
  const { tabBarMode, activeTabBarKey, setActiveTabBarKey } = useGlobalStore();
  const [activeIndex, setActiveIndex] = useState(0);
  const [list, setList] = useState<Tool[]>([]);
  const [loading, setLoading] = useState(false);
  const { onClick: handleToolClick, dialog, closeDialog } = useToolClick();

  const history = useHistory();

  const [swipeOffset, setSwipeOffset] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [slideDirection, setSlideDirection] = useState<'left' | 'right' | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  const fetchList = async (tabKey: 'feature' | 'member') => {
    setLoading(true);
    try {
      const fn = tabKey === 'feature' ? getFeatureTools : getMemberTools;
      const res: any = await fn({ page: 1, pageSize: 50 });
      if (res?.code === 200 && Array.isArray(res.data?.list)) {
        setList(res.data.list as Tool[]);
      } else {
        setList([]);
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[Featured] fetch error:', err);
      setList([]);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchList(TABS[activeIndex].key as 'feature' | 'member');
  }, [activeIndex]);

  const handleTabChange = useCallback((newIndex: number) => {
    if (newIndex === activeIndex || newIndex < 0 || newIndex >= TABS.length) return;
    const direction = newIndex > activeIndex ? 'left' : 'right';
    setSlideDirection(direction);
    setIsTransitioning(true);
    setActiveIndex(newIndex);
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
      if ((activeIndex === 0 && offsetX > 0) || (activeIndex === TABS.length - 1 && offsetX < 0)) {
        setSwipeOffset(offsetX * 0.3);
      } else {
        setSwipeOffset(offsetX);
      }
    },
    onSwipeLeft: () => handleTabChange(activeIndex + 1),
    onSwipeRight: () => handleTabChange(activeIndex - 1),
    onSwipeEnd: () => setSwipeOffset(0),
  });

  const contentStyle: React.CSSProperties = {
    paddingTop: 'calc(var(--header-height) + var(--tabs-height))',
    transform: isTransitioning
      ? undefined
      : swipeOffset !== 0
        ? `translateX(${swipeOffset}px)`
        : undefined,
    transition: swipeOffset !== 0 ? 'none' : undefined,
  };

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
        ) : list.length === 0 ? (
          <div className="page-featured__empty">暂无{TABS[activeIndex].name}</div>
        ) : (
          <div className="page-featured__list">
            {list.map(tool => (
              <div
                key={tool.code}
                className="page-featured__item"
                onClick={() => handleToolClick(tool)}
              >
                <img
                  className="page-featured__icon"
                  src={resolveIcon(tool.icon) || 'https://via.placeholder.com/80'}
                  alt={tool.name}
                  style={{ backgroundColor: tool.color || 'transparent' }}
                />
                <span className="page-featured__name">{tool.name}</span>
                {tool.description && (
                  <span className="page-featured__subtitle">{tool.description}</span>
                )}
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

      <AppModal
        visible={dialog.visible}
        title={dialog.title}
        content={dialog.message}
        confirmText={dialog.confirmText}
        cancelText="取消"
        onConfirm={dialog.onConfirm || closeDialog}
        onCancel={closeDialog}
        onClose={closeDialog}
      />
    </div>
  );
};

export default FeaturedPage;
