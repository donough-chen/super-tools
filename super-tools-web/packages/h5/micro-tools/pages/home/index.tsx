/**
 * 首页 Home
 *
 * 一级页面：搜索框 + 广告位 Banner + 工具分类列表
 * 头部按钮：[search, agent, settings]
 */
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useHistory } from 'umi';
import { utils } from '@/utils';
import { useHomeStore, useGlobalStore } from '../../store';
import AppHeader from '../../components/AppHeader';
import AppTabBar from '../../components/AppTabBar';
import { TAB_BAR_ITEMS } from '../../constants';
import { useSwipe } from '../../hooks/useSwipe';
import './index.less';

/** 图标颜色主题配色映射 */
const ICON_THEME_COLORS: Record<string, { bg: string; color: string }> = {
  default: { bg: 'rgba(22, 119, 255, 0.1)', color: '#1677ff' },
  orange:  { bg: 'rgba(255, 152, 0, 0.12)', color: '#ff9800' },
  green:   { bg: 'rgba(76, 175, 80, 0.12)', color: '#4caf50' },
  blue:    { bg: 'rgba(33, 150, 243, 0.12)', color: '#2196f3' },
  purple:  { bg: 'rgba(156, 39, 176, 0.12)', color: '#9c27b0' },
  red:     { bg: 'rgba(244, 67, 54, 0.12)', color: '#f44336' },
  teal:    { bg: 'rgba(0, 150, 136, 0.12)', color: '#009688' },
  pink:    { bg: 'rgba(233, 30, 99, 0.12)', color: '#e91e63' },
  indigo:  { bg: 'rgba(63, 81, 181, 0.12)', color: '#3f51b5' },
  amber:   { bg: 'rgba(255, 193, 7, 0.12)', color: '#ffc107' },
  cyan:    { bg: 'rgba(0, 188, 212, 0.12)', color: '#00bcd4' },
};

const HomePage: React.FC = () => {
  const { banners, categories, loading, fetchBanners, fetchCategories, toggleCategory, initQuery } = useHomeStore();
  const { toolListMode, tabBarMode, activeTabBarKey, setActiveTabBarKey, isSearchBoxVisible, setSearchBoxVisible } = useGlobalStore();
  const searchBoxRef = useRef<HTMLDivElement>(null);
  const bannerRef = useRef<HTMLDivElement>(null);
  /** 当前 Banner 索引 */
  const [activeBanner, setActiveBanner] = useState(0);

  const history = useHistory();

  useEffect(() => {
    const query = utils.formatUrl();
    initQuery(query);
    fetchBanners();
    fetchCategories();
  }, []);

  // IntersectionObserver 检测搜索框可见性
  useEffect(() => {
    if (!searchBoxRef.current) return;
    const observer = new IntersectionObserver(
      ([entry]) => setSearchBoxVisible(entry.isIntersecting),
      { threshold: 0 },
    );
    observer.observe(searchBoxRef.current);
    return () => observer.disconnect();
  }, []);

  /** 编程式滚动到指定 Banner */
  const scrollToBanner = useCallback((index: number) => {
    const container = bannerRef.current;
    if (!container || banners.length === 0) return;
    const clampedIndex = Math.max(0, Math.min(index, banners.length - 1));
    const itemWidth = container.offsetWidth;
    container.scrollTo({
      left: clampedIndex * itemWidth,
      behavior: 'smooth',
    });
    setActiveBanner(clampedIndex);
  }, [banners.length]);

  /** 监听 Banner 原生 scroll 事件，同步指示器 */
  useEffect(() => {
    const container = bannerRef.current;
    if (!container) return;
    let ticking = false;
    const handleScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const itemWidth = container.offsetWidth;
        if (itemWidth > 0) {
          const newIndex = Math.round(container.scrollLeft / itemWidth);
          setActiveBanner(Math.max(0, Math.min(newIndex, banners.length - 1)));
        }
        ticking = false;
      });
    };
    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => container.removeEventListener('scroll', handleScroll);
  }, [banners.length]);

  /** Banner 区域的滑动手势处理 */
  const bannerSwipeHandlers = useSwipe({
    threshold: 40,
    velocityThreshold: 0.25,
    onSwipeLeft: () => scrollToBanner(activeBanner + 1),
    onSwipeRight: () => scrollToBanner(activeBanner - 1),
  });

  /** 渲染工具图标：优先使用 iconfont，降级到 img */
  const renderToolIcon = (tool: typeof categories[0]['tools'][0]) => {
    const theme = ICON_THEME_COLORS[tool.iconTheme || 'default'] || ICON_THEME_COLORS.default;
    if (tool.fontClass) {
      return (
        <i
          className={`page-home__tool-iconfont iconfont ${tool.fontClass}`}
          style={{ background: theme.bg, color: theme.color }}
        />
      );
    }
    if (tool.icon) {
      return <img className="page-home__tool-icon" src={tool.icon} alt={tool.name} />;
    }
    // 无图标时显示默认占位
    return (
      <i
        className="page-home__tool-iconfont iconfont"
        style={{ background: theme.bg, color: theme.color }}
      />
    );
  };

  return (
    <div className="page-home">
      <AppHeader
        title="首页"
        buttons={[
          {
            type: 'search',
            visible: () => !isSearchBoxVisible,
            onClick: () => history.push('/search'),
          },
          { type: 'agent' },
          { type: 'settings' },
        ]}
      />

      <main className="page-home__content">
        {/* 搜索框 */}
        <div
          ref={searchBoxRef}
          className="page-home__search"
          onClick={() => history.push('/search')}
        >
          <i className="page-home__search-icon iconfont icon-search" />
          <span className="page-home__search-placeholder">搜索所需功能</span>
        </div>

        {/* 广告位 Banner */}
        {banners.length > 0 && (
          <div className="page-home__banner-wrap">
            <div
              ref={bannerRef}
              className="page-home__banner"
              {...bannerSwipeHandlers}
            >
              {banners.map(banner => (
                <div key={banner.id} className="page-home__banner-item">
                  <img src={banner.imageUrl} alt={banner.title} />
                </div>
              ))}
            </div>
            {/* 指示器 */}
            {banners.length > 1 && (
              <div className="page-home__banner-dots">
                {banners.map((banner, idx) => (
                  <span
                    key={banner.id}
                    className={`page-home__banner-dot${idx === activeBanner ? ' page-home__banner-dot--active' : ''}`}
                    onClick={() => scrollToBanner(idx)}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* 工具分类列表 */}
        {loading ? (
          <div className="page-home__loading">加载中...</div>
        ) : (
          <div className={`page-home__categories page-home__categories--${toolListMode}`}>
            {categories.map(cat => (
              <div key={cat.id} className="page-home__category">
                <div className="page-home__category-header" onClick={() => toggleCategory(cat.id)}>
                  <h3>{cat.name}</h3>
                  <span className={`page-home__expand ${cat.expanded ? 'page-home__expand--open' : ''}`} />
                </div>
                {cat.expanded && (
                  <div className={`page-home__tool-list page-home__tool-list--${toolListMode}`}>
                    {cat.tools.map(tool => (
                      <div
                        key={tool.id}
                        className="page-home__tool-item"
                        onClick={() => history.push(tool.url)}
                      >
                        {renderToolIcon(tool)}
                        {/* double/single 模式：图标 + 名称 + 副标题 */}
                        {(toolListMode === 'double' || toolListMode === 'single') ? (
                          <>
                            <div className="page-home__tool-info">
                              <span className="page-home__tool-name">{tool.name}</span>
                              {tool.subtitle && (
                                <span className="page-home__tool-subtitle">{tool.subtitle}</span>
                              )}
                            </div>
                            {/* single 模式右侧箭头 */}
                            <span className="page-home__tool-arrow" />
                          </>
                        ) : (
                          <span className="page-home__tool-name">{tool.name}</span>
                        )}
                      </div>
                    ))}
                  </div>
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
    </div>
  );
};

export default HomePage;
