/**
 * 全局设置 Store
 *
 * 管理所有全局设置项：主题色、导航栏模式、列表展示模式等
 * 设置数据持久化到 localStorage，刷新后自动恢复
 */
import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';

/** 工具列表展示模式 */
export type ToolListMode = 'grid' | 'card' | 'flow' | 'single' | 'double';

/** 收藏列表展示模式 */
export type FavListMode = 'single' | 'double';

/** 底部导航栏模式 */
export type TabBarMode = 'float' | 'flat';

/** 排序方式 */
export type SortType = 'most_used' | 'most_fav' | 'newest';

/** 主题色模式：official 官方多彩 / unified 统一单色 */
export type ThemeColorMode = 'official' | 'unified';

// ==================== 主题色派生工具 ====================

/** hex 颜色 → {r,g,b}（支持 #RGB / #RRGGBB 两种格式） */
const hexToRgb = (hex: string): { r: number; g: number; b: number } => {
  const normalized = hex.replace('#', '').trim();
  const full = normalized.length === 3
    ? normalized.split('').map(c => c + c).join('')
    : normalized;
  if (!/^[0-9a-fA-F]{6}$/.test(full)) {
    // 非法值回退到默认蓝
    return { r: 22, g: 119, b: 255 };
  }
  return {
    r: parseInt(full.slice(0, 2), 16),
    g: parseInt(full.slice(2, 4), 16),
    b: parseInt(full.slice(4, 6), 16),
  };
};

/** {r,g,b} → #RRGGBB */
const rgbToHex = (r: number, g: number, b: number): string => {
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  const to2 = (v: number) => clamp(v).toString(16).padStart(2, '0');
  return `#${to2(r)}${to2(g)}${to2(b)}`;
};

/**
 * 线性混合：把 {r,g,b} 向目标色（白/黑）插值
 * @param amount 0-1，0 不变，1 完全变成目标色
 */
const mix = (
  rgb: { r: number; g: number; b: number },
  target: { r: number; g: number; b: number },
  amount: number,
): { r: number; g: number; b: number } => ({
  r: rgb.r + (target.r - rgb.r) * amount,
  g: rgb.g + (target.g - rgb.g) * amount,
  b: rgb.b + (target.b - rgb.b) * amount,
});

/**
 * 基于主色同步写入所有 CSS 派生色变量
 *  - --primary-color           主色 hex
 *  - --primary-color-rgb       "R, G, B"（rgba() 现场使用）
 *  - --primary-color-hover     亮 12%（与白混合）
 *  - --primary-color-active    暗 12%（与黑混合）
 * 派生色 --primary-color-light / lighter / shadow 由 variables.less 中声明的
 * rgba(var(--primary-color-rgb), x) 自动继承，无需在此重复写入
 */
const applyThemeColorVariables = (hex: string) => {
  const rgb = hexToRgb(hex);
  const root = document.documentElement.style;
  root.setProperty('--primary-color', hex);
  root.setProperty('--primary-color-rgb', `${rgb.r}, ${rgb.g}, ${rgb.b}`);
  const hover = mix(rgb, { r: 255, g: 255, b: 255 }, 0.18);
  const active = mix(rgb, { r: 0, g: 0, b: 0 }, 0.12);
  root.setProperty('--primary-color-hover', rgbToHex(hover.r, hover.g, hover.b));
  root.setProperty('--primary-color-active', rgbToHex(active.r, active.g, active.b));
};

interface GlobalState {
  /** 底部导航栏模式 */
  tabBarMode: TabBarMode;
  /** 工具列表展示模式（首页） */
  toolListMode: ToolListMode;
  /** 收藏列表展示模式（收藏页） */
  favListMode: FavListMode;
  /** 主题色 */
  themeColor: string;
  /** 主题色模式：official 官方多彩 / unified 统一单色 */
  themeColorMode: ThemeColorMode;
  /** 网站排序方式 */
  sortType: SortType;
  /** 当前底部导航激活项 */
  activeTabBarKey: string;
  /** 首页搜索框是否可见（IntersectionObserver 驱动） */
  isSearchBoxVisible: boolean;
}

interface GlobalActions {
  setTabBarMode: (mode: TabBarMode) => void;
  setToolListMode: (mode: ToolListMode) => void;
  setFavListMode: (mode: FavListMode) => void;
  setThemeColor: (color: string) => void;
  setThemeColorMode: (mode: ThemeColorMode) => void;
  setSortType: (type: SortType) => void;
  setActiveTabBarKey: (key: string) => void;
  setSearchBoxVisible: (visible: boolean) => void;
  /** 从 localStorage 恢复设置 */
  restoreSettings: () => void;
}

const STORAGE_KEY = 'micro-tools-settings';

/** 读取本地存储的设置 */
const loadSettings = (): Partial<GlobalState> => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
};

/** 持久化设置到 localStorage */
const saveSettings = (state: GlobalState) => {
  try {
    const { isSearchBoxVisible, activeTabBarKey, ...persistable } = state;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(persistable));
  } catch {
    // 静默失败
  }
};

const initialState: GlobalState = {
  tabBarMode: 'float',
  toolListMode: 'grid',
  favListMode: 'double',
  themeColor: '#1677ff',
  themeColorMode: 'official',
  sortType: 'most_used',
  activeTabBarKey: 'home',
  isSearchBoxVisible: true,
};

export const useGlobalStore = create<GlobalState & GlobalActions>()(
  immer(set => ({
    ...initialState,

    setTabBarMode: mode => {
      set(state => {
        state.tabBarMode = mode;
        saveSettings(state);
      });
    },

    setToolListMode: mode => {
      set(state => {
        state.toolListMode = mode;
        saveSettings(state);
      });
    },

    setFavListMode: mode => {
      set(state => {
        state.favListMode = mode;
        saveSettings(state);
      });
    },

    setThemeColor: color => {
      set(state => {
        state.themeColor = color;
        // 同步更新全部主题色派生 CSS 变量
        applyThemeColorVariables(color);
        saveSettings(state);
      });
    },

    setThemeColorMode: mode => {
      set(state => {
        state.themeColorMode = mode;
        saveSettings(state);
      });
    },

    setSortType: type => {
      set(state => {
        state.sortType = type;
        saveSettings(state);
      });
    },

    setActiveTabBarKey: key => {
      set(state => {
        state.activeTabBarKey = key;
      });
    },

    setSearchBoxVisible: visible => {
      set(state => {
        state.isSearchBoxVisible = visible;
      });
    },

    restoreSettings: () => {
      set(state => {
        const saved = loadSettings();
        if (saved.tabBarMode) state.tabBarMode = saved.tabBarMode;
        if (saved.toolListMode) state.toolListMode = saved.toolListMode;
        if (saved.favListMode) state.favListMode = saved.favListMode;
        if (saved.sortType) state.sortType = saved.sortType;
        if (saved.themeColorMode) state.themeColorMode = saved.themeColorMode;
        if (saved.themeColor) {
          state.themeColor = saved.themeColor;
          applyThemeColorVariables(saved.themeColor);
        } else {
          // 没有本地保存时，也用初始主色写入一次派生变量，保证首屏可用
          applyThemeColorVariables(state.themeColor);
        }
      });
    },
  })),
);

