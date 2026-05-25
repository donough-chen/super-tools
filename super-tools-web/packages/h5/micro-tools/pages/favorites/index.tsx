/**
 * 收藏页 Favorites
 *
 * 一级页面：展示已登录用户的收藏工具列表
 *
 * 头部按钮（初始态）：[agent, search, add]
 *   - search：切换到"本地搜索模式"——头部变为搜索输入框，范围限定在当前收藏列表
 *
 * 交互：
 *   - 点击 item：走 useToolClick（权限校验 + 安全跳转）
 *   - 长按 item：右下角弹出动画操作浮层
 *       · 取消收藏（removeFavorite）
 *       · 调整排序 → 跳转 /favorites/reorder
 *
 * 数据：
 *   - 进入页面后 fetchList 拉取完整收藏列表（一次性 100 条足以）
 *   - 从排序页返回时会自动 fetchList 刷新（排序 store 中 reorder 会调用 fetchList）
 */
import React, { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { navigateTo } from '@/utils/navigator';
import { useFavoritesStore, useGlobalStore, useUserStore } from '../../store';
import { useToolClick } from '../../hooks/useToolClick';
import { useLongPress } from '../../hooks/useLongPress';
import AppHeader from '../../components/AppHeader';
import AppTabBar from '../../components/AppTabBar';
import AppModal from '../../components/AppModal';
import ToolActionPopup from '../../components/ToolActionPopup';
import type { ToolActionItem } from '../../components/ToolActionPopup';
import { TAB_BAR_ITEMS } from '../../constants';
import { resolveIcon } from '../../utils/icon';
import HexColorIcon from '../../components/HexColorIcon';
import type { Favorite } from '../../types/favorite';
import './index.less';

/** 默认主题色（当 tool.color 未提供时的兜底） */
const DEFAULT_THEME = { bg: 'rgba(22, 119, 255, 0.1)', color: '#1677ff' };

/** 根据后端 color(#HEX) 生成透明背景 + 前景色 */
function colorToTheme(hex?: string): { bg: string; color: string } {
  if (!hex) return DEFAULT_THEME;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  if (isNaN(r) || isNaN(g) || isNaN(b)) return DEFAULT_THEME;
  return { bg: `rgba(${r}, ${g}, ${b}, 0.12)`, color: hex };
}

/** 渲染工具图标：外层白底容器 + 内部主题色染色图标，提升层次感 */
function renderFavIcon(fav: Favorite, themeColorMode: 'official' | 'unified', unifiedColor: string) {
  const theme = colorToTheme(fav.tool.color);
  const iconUrl = resolveIcon(fav.tool.icon);
  if (iconUrl) {
    const iconColor = themeColorMode === 'unified' ? unifiedColor : fav.tool.color;
    return (
      <span className="page-favorites__tool-icon-wrap">
        <HexColorIcon
          className="page-favorites__tool-iconfont iconfont"
          src={iconUrl}
          color={iconColor}
          alt={fav.tool.name}
        />
      </span>
    );
  }
  return (
    <span className="page-favorites__tool-icon-wrap">
      <i
        className="page-favorites__tool-iconfont iconfont"
        style={{ background: theme.bg, color: theme.color }}
      />
    </span>
  );
}

/**
 * 单个收藏项（提取到组件外部）。
 *
 * 关键：**绝不能**定义在 FavoritesPage 内部——那样每次父组件 re-render
 * 此组件会被 React 视为全新类型整棵子树卸载重建，导致 useRef/长按状态丢失，
 * 长按浮层永远无法显示。
 */
interface FavoriteItemProps {
  fav: Favorite;
  isPopupOpen: boolean;
  themeColorMode: 'official' | 'unified';
  unifiedColor: string;
  onLongPress: (toolCode: string) => void;
  onItemClick: (tool: Favorite['tool']) => void;
  onClosePopup: () => void;
  actions: ToolActionItem[];
}

const FavoriteItem: React.FC<FavoriteItemProps> = React.memo(({
  fav,
  isPopupOpen,
  themeColorMode,
  unifiedColor,
  onLongPress,
  onItemClick,
  onClosePopup,
  actions,
}) => {
  const itemRef = useRef<HTMLDivElement>(null);
  const longPressBind = useLongPress({
    onLongPress: () => onLongPress(fav.toolCode),
    onClick: () => onItemClick(fav.tool),
    delay: 500,
  });

  return (
    <div
      ref={itemRef}
      className={`page-favorites__item${isPopupOpen ? ' page-favorites__item--active' : ''}`}
      {...longPressBind}
    >
      {renderFavIcon(fav, themeColorMode, unifiedColor)}
      <div className="page-favorites__tool-info">
        <span className="page-favorites__tool-name">{fav.tool.name}</span>
        {fav.tool.description && (
          <span className="page-favorites__tool-subtitle">{fav.tool.description}</span>
        )}
      </div>
      <span className="page-favorites__tool-arrow" />

      <ToolActionPopup
        visible={isPopupOpen}
        actions={actions}
        targetRef={itemRef}
        onClose={onClosePopup}
      />
    </div>
  );
});
FavoriteItem.displayName = 'FavoriteItem';

const FavoritesPage: React.FC = () => {
  const list = useFavoritesStore(s => s.list);
  const loading = useFavoritesStore(s => s.loading);
  const fetchList = useFavoritesStore(s => s.fetchList);
  const removeFavorite = useFavoritesStore(s => s.removeFavorite);
  const isLoggedIn = useUserStore(s => s.isLoggedIn);
  const { favListMode, tabBarMode, themeColorMode, themeColor } = useGlobalStore();

  const { onClick: handleToolClick, dialog, closeDialog } = useToolClick();

  /** 搜索模式开关 */
  const [searchMode, setSearchMode] = useState(false);
  /** 搜索关键词（本地过滤） */
  const [keyword, setKeyword] = useState('');
  /** 当前长按打开浮层的 toolCode */
  const [popupToolCode, setPopupToolCode] = useState<string | null>(null);
  /** 轻提示 */
  const [toast, setToast] = useState<string | null>(null);

  // 登录态下拉取完整收藏列表
  useEffect(() => {
    if (isLoggedIn) fetchList();
  }, [isLoggedIn]);

  // toast 自动消失
  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 2400);
    return () => clearTimeout(id);
  }, [toast]);

  /** 本地过滤后的展示列表（按 sort ASC，store 已保证） */
  const filteredList = useMemo(() => {
    if (!keyword.trim()) return list;
    const kw = keyword.trim().toLowerCase();
    return list.filter((f) => {
      const t = f.tool;
      return (
        (t.name || '').toLowerCase().includes(kw) ||
        (t.description || '').toLowerCase().includes(kw) ||
        (t.keyword || '').toLowerCase().includes(kw) ||
        (t.code || '').toLowerCase().includes(kw)
      );
    });
  }, [list, keyword]);

  const handleToggleSearch = useCallback(() => {
    setSearchMode((m) => {
      const next = !m;
      if (!next) setKeyword(''); // 关闭搜索时清空 keyword
      return next;
    });
  }, []);

  /** 长按 → 打开浮层 */
  const handleLongPress = useCallback((toolCode: string) => {
    setPopupToolCode(toolCode);
  }, []);

  /** 关闭浮层 */
  const handleClosePopup = useCallback(() => setPopupToolCode(null), []);

  /** 点击 item */
  const handleItemClick = useCallback((tool: Favorite['tool']) => {
    handleToolClick(tool);
  }, [handleToolClick]);

  /** 构造某个 item 的操作列表 */
  const buildActions = useCallback((toolCode: string): ToolActionItem[] => [
    {
      key: 'unfavorite',
      label: '取消收藏',
      variant: 'danger',
      onClick: async () => {
        const ok = await removeFavorite(toolCode);
        setToast(ok ? '已取消收藏' : '操作失败');
      },
    },
    {
      key: 'reorder',
      label: '调整排序',
      variant: 'primary',
      onClick: () => {
        navigateTo('/favorites/reorder');
      },
    },
  ], [removeFavorite]);

  /** 头部：搜索模式下替换为 rightSlot 的输入框形态 */
  const headerProps = searchMode
    ? {
      title: '',
      rightSlot: (
        <div className="page-favorites__header-search">
          <input
            className="page-favorites__header-input"
            type="text"
            autoFocus
            value={keyword}
            placeholder="在收藏中搜索..."
            onChange={(e) => setKeyword(e.target.value)}
          />
          <div
            className="page-favorites__header-cancel"
            onClick={handleToggleSearch}
          >
            取消
          </div>
        </div>
      ),
    }
    : {
      title: '收藏',
      buttons: [
        { type: 'agent' as const },
        { type: 'search' as const, onClick: handleToggleSearch },
        { type: 'add' as const, onClick: () => navigateTo('/') },
      ],
    };

  return (
    <div className="page-favorites">
      <AppHeader {...headerProps} />

      <main
        className={`page-favorites__content${searchMode ? ' page-favorites__content--search' : ''}`}
      >
        {loading ? (
          <div className="page-favorites__loading">加载中...</div>
        ) : filteredList.length === 0 ? (
          <div className="page-favorites__empty">
            {keyword ? '未搜索到相关收藏' : '暂无收藏，去首页发现更多工具吧'}
          </div>
        ) : (
          <div className={`page-favorites__list page-favorites__list--${favListMode}`}>
            {filteredList.map(fav => (
              <FavoriteItem
                key={fav.toolCode}
                fav={fav}
                isPopupOpen={popupToolCode === fav.toolCode}
                themeColorMode={themeColorMode}
                unifiedColor={themeColor}
                onLongPress={handleLongPress}
                onItemClick={handleItemClick}
                onClosePopup={handleClosePopup}
                actions={buildActions(fav.toolCode)}
              />
            ))}
          </div>
        )}
      </main>

      {!searchMode && <AppTabBar mode={tabBarMode} items={TAB_BAR_ITEMS} />}

      {/* 轻提示 */}
      {toast && <div className="page-favorites__toast">{toast}</div>}

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

export default FavoritesPage;
