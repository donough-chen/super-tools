/**
 * 收藏页 Store
 *
 * 管理：收藏工具列表、收藏操作
 */
import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { getFavoriteTools, addFavorite, removeFavorite } from '../service';
import type { ToolItem } from './home';

interface FavoritesState {
  list: ToolItem[];
  loading: boolean;
  error: string | null;
}

interface FavoritesActions {
  fetchList: () => Promise<void>;
  addToFavorites: (toolId: string) => Promise<void>;
  removeFromFavorites: (toolId: string) => Promise<void>;
  reset: () => void;
}

const initialState: FavoritesState = {
  list: [],
  loading: false,
  error: null,
};

export const useFavoritesStore = create<FavoritesState & FavoritesActions>()(
  immer(set => ({
    ...initialState,

    fetchList: async () => {
      set(state => {
        state.loading = true;
        state.error = null;
      });
      try {
        const res = await getFavoriteTools();
        set(state => {
          state.list = (res?.code === 0 && res.data) ? res.data : [];
          state.loading = false;
        });
      } catch (err) {
        set(state => {
          state.error = err instanceof Error ? err.message : '请求失败';
          state.loading = false;
        });
      }
    },

    addToFavorites: async toolId => {
      try {
        await addFavorite(toolId);
        // 刷新列表
        const res = await getFavoriteTools();
        set(state => {
          state.list = (res?.code === 0 && res.data) ? res.data : [];
        });
      } catch (err) {
        console.error('[Favorites] addToFavorites error:', err);
      }
    },

    removeFromFavorites: async toolId => {
      try {
        await removeFavorite(toolId);
        set(state => {
          state.list = state.list.filter(item => item.id !== toolId);
        });
      } catch (err) {
        console.error('[Favorites] removeFromFavorites error:', err);
      }
    },

    reset: () => {
      set(() => ({ ...initialState }));
    },
  })),
);
