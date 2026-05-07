/**
 * 首页 Store
 *
 * 管理：广告位 Banner、工具分类列表、搜索框可见性
 */
import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { getBannerList, getToolCategories } from '../service';

export interface BannerItem {
  id: string;
  imageUrl: string;
  linkUrl: string;
  title: string;
}

/** 图标颜色主题 */
export type IconTheme = 'default' | 'orange' | 'green' | 'blue' | 'purple' | 'red' | 'teal' | 'pink' | 'indigo' | 'amber' | 'cyan';

export interface ToolItem {
  id: string;
  name: string;
  icon: string;
  /** iconfont font-class 名称，如 'icon-json' */
  fontClass?: string;
  /** 图标颜色主题 */
  iconTheme?: IconTheme;
  subtitle?: string;
  category: string;
  url: string;
  /** 内容类型：原生页面 / iframe / 外链 */
  contentType: 'native' | 'iframe' | 'external';
}

export interface ToolCategory {
  id: string;
  name: string;
  icon?: string;
  tools: ToolItem[];
  /** 是否展开 */
  expanded: boolean;
}

interface HomeState {
  banners: BannerItem[];
  categories: ToolCategory[];
  loading: boolean;
  error: string | null;
  query: Record<string, string>;
}

interface HomeActions {
  initQuery: (query: Record<string, string>) => void;
  fetchBanners: () => Promise<void>;
  fetchCategories: () => Promise<void>;
  toggleCategory: (categoryId: string) => void;
  reset: () => void;
}

const initialState: HomeState = {
  banners: [],
  categories: [],
  loading: false,
  error: null,
  query: {},
};

export const useHomeStore = create<HomeState & HomeActions>()(
  immer(set => ({
    ...initialState,

    initQuery: query => {
      set(state => {
        state.query = query;
      });
    },

    fetchBanners: async () => {
      try {
        const res = await getBannerList();
        set(state => {
          state.banners = (res?.code === 0 && res.data) ? res.data : [];
        });
      } catch (err) {
        console.error('[Home] fetchBanners error:', err);
      }
    },

    fetchCategories: async () => {
      set(state => {
        state.loading = true;
        state.error = null;
      });
      try {
        const res = await getToolCategories();
        const list = (res?.code === 0 && res.data) ? res.data : [];
        set(state => {
          state.categories = list.map((cat: any) => ({
            ...cat,
            expanded: true,
          }));
          state.loading = false;
        });
      } catch (err) {
        set(state => {
          state.error = err instanceof Error ? err.message : '请求失败';
          state.loading = false;
        });
      }
    },

    toggleCategory: categoryId => {
      set(state => {
        const cat = state.categories.find(c => c.id === categoryId);
        if (cat) cat.expanded = !cat.expanded;
      });
    },

    reset: () => {
      set(() => ({ ...initialState }));
    },
  })),
);
