/**
 * 底部导航栏配置项
 *
 * 说明：active 状态的图标颜色由 AppTabBar 内部基于主题色（themeColor）通过
 * HexColorIcon 动态染色，因此此处不再需要单独配置 activeIcon。
 */
export const TAB_BAR_ITEMS = [
  { key: 'home', name: '首页', icon: '/assets/icons/home.png' },
  { key: 'favorites', name: '收藏', icon: '/assets/icons/favorites.png' },
  { key: 'featured', name: '特色', icon: '/assets/icons/featured.png' },
  { key: 'sites', name: '网站', icon: '/assets/icons/sites.png' },
  { key: 'mine', name: '我的', icon: '/assets/icons/mine.png' },
];

/**
 * 工具列表展示模式选项
 */
export const TOOL_LIST_MODES = [
  { key: 'grid', name: '宫格' },
  { key: 'card', name: '方格' },
  { key: 'flow', name: '流式' },
  { key: 'single', name: '单列' },
  { key: 'double', name: '双列' },
] as const;

/**
 * 收藏列表展示模式选项
 */
export const FAV_LIST_MODES = [
  { key: 'single', name: '单列' },
  { key: 'double', name: '双列' },
] as const;

/**
 * 排序选项
 */
export const SORT_OPTIONS = [
  { key: 'most_used', name: '最多使用' },
  { key: 'most_fav', name: '最多收藏' },
  { key: 'newest', name: '最新投稿' },
] as const;
