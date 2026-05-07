/**
 * 网站页 Store
 *
 * 管理：网站分类 Tab、网站列表、排序
 */
import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { getSiteCategories, getSiteList } from '../service';
import type { SortType } from './global';

export interface SiteCategory {
  id: string;
  name: string;
  icon?: string;
}

export interface SiteItem {
  id: string;
  name: string;
  icon: string;
  url: string;
  userCount: number;
  favCount: number;
  createdAt: string;
}

interface SitesState {
  categories: SiteCategory[];
  activeTabIndex: number;
  sites: SiteItem[];
  loading: boolean;
  error: string | null;
}

interface SitesActions {
  fetchCategories: () => Promise<void>;
  setActiveTab: (index: number) => void;
  fetchSites: (categoryId: string, sortType?: SortType) => Promise<void>;
  reset: () => void;
}

const initialState: SitesState = {
  categories: [],
  activeTabIndex: 0,
  sites: [],
  loading: false,
  error: null,
};

export const useSitesStore = create<SitesState & SitesActions>()(
  immer(set => ({
    ...initialState,

    fetchCategories: async () => {
      try {
        const res = await getSiteCategories();
        set(state => {
          state.categories = (res?.code === 0 && res.data) ? res.data : [];
        });
      } catch (err) {
        console.error('[Sites] fetchCategories error:', err);
      }
    },

    setActiveTab: index => {
      set(state => {
        state.activeTabIndex = index;
      });
    },

    fetchSites: async (categoryId, sortType = 'most_used') => {
      set(state => {
        state.loading = true;
        state.error = null;
      });
      try {
        const res = await getSiteList({ categoryId, sortType });
        set(state => {
          state.sites = (res?.code === 0 && res.data) ? res.data : [];
          state.loading = false;
        });
      } catch (err) {
        set(state => {
          state.error = err instanceof Error ? err.message : '请求失败';
          state.loading = false;
        });
      }
    },

    reset: () => {
      set(() => ({ ...initialState }));
    },
  })),
);
