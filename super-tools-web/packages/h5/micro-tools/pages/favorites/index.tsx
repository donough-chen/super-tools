/**
 * 收藏页 Favorites
 *
 * 一级页面：展示用户收藏工具列表
 * 头部按钮：[agent, search, add]
 */
import React, { useEffect } from 'react';
import { useHistory } from 'umi';
import { useFavoritesStore, useGlobalStore } from '../../store';
import AppHeader from '../../components/AppHeader';
import AppTabBar from '../../components/AppTabBar';
import { TAB_BAR_ITEMS } from '../../constants';
import './index.less';

/** 图标颜色主题配色映射（与首页保持一致） */
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

const FavoritesPage: React.FC = () => {
  const { list, loading, fetchList } = useFavoritesStore();
  const { favListMode, tabBarMode, activeTabBarKey, setActiveTabBarKey } = useGlobalStore();

  const history = useHistory();

  useEffect(() => {
    fetchList();
  }, []);

  /** 渲染工具图标：优先使用 iconfont，降级到 img（与首页逻辑一致） */
  const renderToolIcon = (tool: typeof list[0]) => {
    const theme = ICON_THEME_COLORS[tool.iconTheme || 'default'] || ICON_THEME_COLORS.default;
    if (tool.fontClass) {
      return (
        <i
          className={`page-favorites__tool-iconfont iconfont ${tool.fontClass}`}
          style={{ background: theme.bg, color: theme.color }}
        />
      );
    }
    if (tool.icon) {
      return <img className="page-favorites__tool-icon" src={tool.icon} alt={tool.name} />;
    }
    // 无图标时显示默认占位
    return (
      <i
        className="page-favorites__tool-iconfont iconfont"
        style={{ background: theme.bg, color: theme.color }}
      />
    );
  };

  return (
    <div className="page-favorites">
      <AppHeader
        title="收藏"
        buttons={[
          { type: 'agent' },
          { type: 'search', onClick: () => history.push('/search') },
          { type: 'add', onClick: () => history.push('/') },
        ]}
      />

      <main className="page-favorites__content">
        {loading ? (
          <div className="page-favorites__loading">加载中...</div>
        ) : list.length === 0 ? (
          <div className="page-favorites__empty">暂无收藏，去首页发现更多工具吧</div>
        ) : (
          <div className={`page-favorites__list page-favorites__list--${favListMode}`}>
            {list.map(tool => (
              <div
                key={tool.id}
                className="page-favorites__item"
                onClick={() => history.push(tool.url)}
              >
                {renderToolIcon(tool)}
                <div className="page-favorites__tool-info">
                  <span className="page-favorites__tool-name">{tool.name}</span>
                  {tool.subtitle && (
                    <span className="page-favorites__tool-subtitle">{tool.subtitle}</span>
                  )}
                </div>
                {/* single 模式右侧箭头 */}
                <span className="page-favorites__tool-arrow" />
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

export default FavoritesPage;
