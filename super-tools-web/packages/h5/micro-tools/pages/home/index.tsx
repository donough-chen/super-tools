/**
 * 首页 Home
 *
 * 一级页面：搜索框 + 广告位 Banner（特色工具充当） + 工具分类列表
 * 头部按钮：[search, agent, settings]
 *
 * 数据来源：
 *  - useHomeStore.fetchHomeData() — 聚合模式一次性加载全部分类+工具
 *  - useFavoritesStore.fetchCodes() — 登录态下拉取已收藏 code 集合，用于心形标注
 *
 * 交互：
 *  - 普通点击工具：走 useToolClick（权限校验 + 跳转）
 *  - 长按工具项：右下角弹出操作浮层（收藏 / 取消收藏）
 *  - 已收藏工具：右下角心形角标
 */
import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { navigateTo } from '@/utils/navigator';
import { useHomeStore, useGlobalStore, useFavoritesStore, useUserStore } from '../../store';
import type { ToolListMode } from '../../store/global';
import { useToolClick } from '../../hooks/useToolClick';
import { useLongPress } from '../../hooks/useLongPress';
import AppHeader from '../../components/AppHeader';
import AppTabBar from '../../components/AppTabBar';
import AppModal from '../../components/AppModal';
import ToolActionPopup from '../../components/ToolActionPopup';
import type { ToolActionItem } from '../../components/ToolActionPopup';
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

/** 渲染工具图标：优先使用 resolved icon 图片，降级到颜色占位 */
function renderToolIcon(tool: ToolViewItem) {
  const theme = colorToTheme(tool.color);
  if (tool.iconResolved) {
    return <img className="page-home__tool-iconfont iconfont" src={tool.iconResolved} alt={tool.name} />;
  }
  return (
    <i
      className="page-home__tool-iconfont iconfont"
      style={{ background: theme.bg, color: theme.color }}
    />
  );
}

/**
 * 单个工具 item 子组件（提取到组件外部）。
 *
 * 关键：**绝不能**把它定义在 HomePage 内部——那样每次父组件 re-render，
 * ToolItem 会成为新的函数引用，React 视为新的组件类型，整棵子树卸载重建，
 * 导致 useRef/useLongPress 内部状态全部重置，长按弹浮层彻底失效。
 */
interface ToolItemProps {
  tool: ToolViewItem;
  favorited: boolean;
  isPopupOpen: boolean;
  toolListMode: ToolListMode;
  onLongPress: (toolCode: string) => void;
  onItemClick: (tool: Tool) => void;
  onClosePopup: () => void;
  popupActions: ToolActionItem[];
}

const ToolItem: React.FC<ToolItemProps> = React.memo(({
  tool,
  favorited,
  isPopupOpen,
  toolListMode,
  onLongPress,
  onItemClick,
  onClosePopup,
  popupActions,
}) => {
  const itemRef = useRef<HTMLDivElement>(null);
  const longPressBind = useLongPress({
    onLongPress: () => onLongPress(tool.id),
    onClick: () => onItemClick(tool._raw),
    delay: 500,
  });

  return (
    <div
      ref={itemRef}
      className={`page-home__tool-item${isPopupOpen ? ' page-home__tool-item--active' : ''}`}
      {...longPressBind}
    >
      {renderToolIcon(tool)}
      {(toolListMode === 'double' || toolListMode === 'single') ? (
        <>
          <div className="page-home__tool-info">
            <span className="page-home__tool-name">{tool.name}</span>
            {tool.subtitle && (
              <span className="page-home__tool-subtitle">{tool.subtitle}</span>
            )}
          </div>
          <span className="page-home__tool-arrow" />
        </>
      ) : (
        <span className="page-home__tool-name">{tool.name}</span>
      )}

      {favorited && (
        <span className="page-home__tool-fav-badge" aria-label="已收藏" />
      )}

      <ToolActionPopup
        visible={isPopupOpen}
        actions={popupActions}
        targetRef={itemRef}
        onClose={onClosePopup}
      />
    </div>
  );
});
ToolItem.displayName = 'ToolItem';

const HomePage: React.FC = () => {
  const {
    categories: rawCategories,
    toolsByCategory,
    bannerTools,
    loading,
    fetchHomeData,
  } = useHomeStore();
  const { toolListMode, tabBarMode, isSearchBoxVisible, setSearchBoxVisible } = useGlobalStore();
  const favoritesCodes = useFavoritesStore(s => s.codes);
  const fetchFavoriteCodes = useFavoritesStore(s => s.fetchCodes);
  const addFavorite = useFavoritesStore(s => s.addFavorite);
  const removeFavorite = useFavoritesStore(s => s.removeFavorite);
  const isLoggedIn = useUserStore(s => s.isLoggedIn);
  const { onClick: handleToolClick, dialog, closeDialog } = useToolClick();
  const searchBoxRef = useRef<HTMLDivElement>(null);
  const bannerRef = useRef<HTMLDivElement>(null);
  /** 当前 Banner 索引 */
  const [activeBanner, setActiveBanner] = useState(0);
  /** 分类展开/折叠状态 */
  const [expandedMap, setExpandedMap] = useState<Record<string, boolean>>({});
  /** 长按弹出操作浮层的目标工具 code（同一时间只能有一个） */
  const [popupToolCode, setPopupToolCode] = useState<string | null>(null);
  /** 轻提示 toast */
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    fetchHomeData();
  }, []);

  // 登录后拉取收藏 code 集合（用于心形标注）
  useEffect(() => {
    if (isLoggedIn) fetchFavoriteCodes();
  }, [isLoggedIn]);

  // 初始化展开状态（全部展开）
  useEffect(() => {
    if (rawCategories.length > 0 && Object.keys(expandedMap).length === 0) {
      const map: Record<string, boolean> = {};
      rawCategories.forEach(c => { map[c.code] = true; });
      setExpandedMap(map);
    }
  }, [rawCategories]);

  /** 收藏 code Set（O(1) 查询） */
  const favSet = useMemo(() => new Set(favoritesCodes), [favoritesCodes]);

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

  /** 3 秒后自动隐藏 toast */
  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 2400);
    return () => clearTimeout(id);
  }, [toast]);

  /** 长按工具项 → 打开操作浮层 */
  const handleLongPressTool = useCallback((toolCode: string) => {
    if (!isLoggedIn) {
      setToast('请先登录后再收藏');
      return;
    }
    setPopupToolCode(toolCode);
  }, [isLoggedIn]);

  /** 关闭浮层 */
  const handleClosePopup = useCallback(() => setPopupToolCode(null), []);

  /** item 普通点击 */
  const handleItemClick = useCallback((tool: Tool) => {
    handleToolClick(tool);
  }, [handleToolClick]);

  /** 生成某个工具的 popupActions（根据收藏态） */
  const buildPopupActions = useCallback((toolId: string, favorited: boolean): ToolActionItem[] => (
    favorited
      ? [{
        key: 'unfavorite',
        label: '取消收藏',
        variant: 'danger',
        onClick: async () => {
          const ok = await removeFavorite(toolId);
          setToast(ok ? '已取消收藏' : '操作失败');
        },
      }]
      : [{
        key: 'favorite',
        label: '收藏工具',
        variant: 'primary',
        onClick: async () => {
          const ok = await addFavorite(toolId);
          setToast(ok ? '已收藏' : '收藏失败');
        },
      }]
  ), [addFavorite, removeFavorite]);

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
                    {cat.tools.map(tool => {
                      const favorited = favSet.has(tool.id);
                      return (
                        <ToolItem
                          key={tool.id}
                          tool={tool}
                          favorited={favorited}
                          isPopupOpen={popupToolCode === tool.id}
                          toolListMode={toolListMode}
                          onLongPress={handleLongPressTool}
                          onItemClick={handleItemClick}
                          onClosePopup={handleClosePopup}
                          popupActions={buildPopupActions(tool.id, favorited)}
                        />
                      );
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </main>

      <AppTabBar mode={tabBarMode} items={TAB_BAR_ITEMS} />

      {/* 轻提示 */}
      {toast && <div className="page-home__toast">{toast}</div>}

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
