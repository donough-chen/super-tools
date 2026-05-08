/**
 * 首页 Home
 *
 * 一级页面：搜索框 + 广告位 Banner（特色工具充当） + 工具分类列表
 * 头部按钮：[search, agent, settings]
 *
 * 数据来源：useHomeStore.fetchHomeData() — 聚合模式一次性加载全部分类+工具
 */
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { navigateTo } from '@/utils/navigator';
import { useHomeStore, useGlobalStore } from '../../store';
import { useToolClick } from '../../hooks/useToolClick';
import AppHeader from '../../components/AppHeader';
import AppTabBar from '../../components/AppTabBar';
import AppModal from '../../components/AppModal';
import { TAB_BAR_ITEMS } from '../../constants';
import { useSwipe } from '../../hooks/useSwipe';
import type { Tool } from '../../types/tool';
import { resolveIcon } from '../../utils/icon';
import './index.less';

/** 图标颜色主题配色映射（保留原始主题色逻辑作为后端 color 字段的兜底） */
const DEFAULT_THEME = { bg: 'rgba(22, 119, 255, 0.1)', color: '#1677ff' };

/** 根据后端 color(#HEX) 生成透明背景 + 前景色 */
function colorToTheme(hex?: string): { bg: string; color: string } {
  if (!hex) return DEFAULT_THEME;
  // 将 #RRGGBB 转为 rgba(R, G, B, 0.12) 背景
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  if (isNaN(r) || isNaN(g) || isNaN(b)) return DEFAULT_THEME;
  return { bg: `rgba(${r}, ${g}, ${b}, 0.12)`, color: hex };
}

/** 带分类的工具数据结构（兼容原有布局） */
interface CategoryWithTools {
  id: string;
  name: string;
  icon?: string;
  tools: ToolViewItem[];
  expanded: boolean;
}

/** 页面视图层工具 item（从后端 Tool 映射而来） */
interface ToolViewItem {
  id: string;
  name: string;
  icon?: string;
  iconResolved?: string;
  color?: string;
  subtitle?: string;
  url: string;
  _raw: Tool;
}

/** 将后端 Tool 映射为页面视图 item */
function mapToolToView(tool: Tool): ToolViewItem {
  return {
    id: tool.code,
    name: tool.name,
    icon: tool.icon || undefined,
    iconResolved: resolveIcon(tool.icon),
    color: tool.color || undefined,
    subtitle: tool.description || undefined,
    url: tool.path,
    _raw: tool,
  };
}

const HomePage: React.FC = () => {
  const {
    categories: rawCategories,
    toolsByCategory,
    bannerTools,
    loading,
    fetchHomeData,
  } = useHomeStore();
  const { toolListMode, tabBarMode, isSearchBoxVisible, setSearchBoxVisible } = useGlobalStore();
  const { onClick: handleToolClick, dialog, closeDialog } = useToolClick();
  const searchBoxRef = useRef<HTMLDivElement>(null);
  const bannerRef = useRef<HTMLDivElement>(null);
  /** 当前 Banner 索引 */
  const [activeBanner, setActiveBanner] = useState(0);
  /** 分类展开/折叠状态 */
  const [expandedMap, setExpandedMap] = useState<Record<string, boolean>>({});

  useEffect(() => {
    fetchHomeData();
  }, []);

  // 初始化展开状态（全部展开）
  useEffect(() => {
    if (rawCategories.length > 0 && Object.keys(expandedMap).length === 0) {
      const map: Record<string, boolean> = {};
      rawCategories.forEach(c => { map[c.code] = true; });
      setExpandedMap(map);
    }
  }, [rawCategories]);

  /** 构造与原始布局兼容的 categories 数据 */
  const categories: CategoryWithTools[] = rawCategories.map(cat => ({
    id: cat.code,
    name: cat.name,
    icon: cat.icon || undefined,
    tools: (toolsByCategory[cat.code] || []).map(mapToolToView),
    expanded: expandedMap[cat.code] !== false,
  }));

  /** Banner 数据：用特色工具的 icon 和信息充当 */
  const banners = bannerTools.map(t => ({
    id: t.code,
    imageUrl: resolveIcon(t.icon) || '',
    linkUrl: t.path,
    title: t.name,
    _raw: t,
  }));

  const toggleCategory = (categoryId: string) => {
    setExpandedMap(prev => ({ ...prev, [categoryId]: !prev[categoryId] }));
  };

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

  /** 渲染工具图标：优先使用 resolved icon 图片，降级到颜色占位 */
  const renderToolIcon = (tool: ToolViewItem) => {
    const theme = colorToTheme(tool.color);
    if (tool.iconResolved) {
      return <img className="page-home__tool-iconfont iconfont" src={tool.iconResolved} alt={tool.name} />;
    }
    // 无图标时显示颜色占位
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
            onClick: () => navigateTo('/search'),
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
          onClick={() => navigateTo('/search')}
        >
          <i className="page-home__search-icon iconfont icon-search" />
          <span className="page-home__search-placeholder">搜索所需功能</span>
        </div>

        {/* 广告位 Banner（特色工具充当） */}
        {banners.length > 0 && (
          <div className="page-home__banner-wrap">
            <div
              ref={bannerRef}
              className="page-home__banner"
              {...bannerSwipeHandlers}
            >
              {banners.map(banner => (
                <div
                  key={banner.id}
                  className="page-home__banner-item"
                  onClick={() => handleToolClick(banner._raw)}
                >
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
                  <span className={`page-home__expand ${cat.expanded ? '' : 'page-home__expand--closed'}`} />
                </div>
                {cat.expanded && (
                  <div className={`page-home__tool-list page-home__tool-list--${toolListMode}`}>
                    {cat.tools.map(tool => (
                      <div
                        key={tool.id}
                        className="page-home__tool-item"
                        onClick={() => handleToolClick(tool._raw)}
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

      <AppTabBar mode={tabBarMode} items={TAB_BAR_ITEMS} />

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

export default HomePage;
