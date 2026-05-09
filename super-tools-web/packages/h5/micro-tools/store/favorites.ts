/**
 * 收藏页 Store（v2，对接 /api/favorites 新后端接口）
 *
 * 职责：
 *  - `list`：完整收藏列表（含嵌套 tool 对象），供个人中心展示
 *  - `codes`：已收藏工具 code 集合（轻量，供工具列表页批量标注心形）
 *  - `loading / error`：通用加载态
 *
 * 操作：
 *  - fetchList(): 拉取分页列表（一次性取 pageSize 最大 100 条足以覆盖个人收藏）
 *  - fetchCodes(): 拉取 code 集合（工具列表页用）
 *  - addFavorite(toolCode): 收藏并同步更新 list & codes
 *  - removeFavorite(toolCode): 取消收藏并同步更新 list & codes
 *  - toggleFavorite(toolCode): 根据 codes 判断已收藏态，自动切换
 *  - reorder(orderedToolCodes): 提交拖拽排序，成功后刷新 list
 *
 * 注意：未登录时所有接口会 401，store 静默处理，不主动引导登录（由上层 UI 判定）
 */
import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import {
  getFavoriteListApi,
  getFavoriteCodesApi,
  addFavoriteApi,
  removeFavoriteApi,
  reorderFavoritesApi,
} from '../service/favorite';
import type { Favorite } from '../types/favorite';

interface FavoritesState {
  /** 完整收藏列表（按 sort ASC 排序） */
  list: Favorite[];
  /** 已收藏工具 code 集合（轻量，供工具列表页批量标注） */
  codes: string[];
  loading: boolean;
  error: string | null;
}

interface FavoritesActions {
  fetchList: (opts?: { silent?: boolean }) => Promise<void>;
  fetchCodes: () => Promise<void>;
  /**
   * 幂等收藏：若已收藏（codes 包含）则直接返回 true
   * @returns 是否最终处于已收藏态
   */
  addFavorite: (toolCode: string) => Promise<boolean>;
  /**
   * 幂等取消收藏：若未收藏则直接返回 true
   * @returns 操作是否成功（true 表示当前确实处于未收藏态）
   */
  removeFavorite: (toolCode: string) => Promise<boolean>;
  /**
   * 切换收藏态：根据 codes 判断当前态
   * @returns 切换后是否处于已收藏态
   */
  toggleFavorite: (toolCode: string) => Promise<boolean>;
  /** 提交拖拽排序（orderedToolCodes 必须包含全部已收藏工具 code） */
  reorder: (orderedToolCodes: string[]) => Promise<boolean>;
  /** 判断某工具是否已收藏（基于 codes） */
  isFavorited: (toolCode: string) => boolean;
  reset: () => void;
}

const initialState: FavoritesState = {
  list: [],
  codes: [],
  loading: false,
  error: null,
};

export const useFavoritesStore = create<FavoritesState & FavoritesActions>()(
  immer((set, get) => ({
    ...initialState,

    fetchList: async (opts) => {
      if (!opts?.silent) set(s => { s.loading = true; s.error = null; });
      try {
        // 一次性拉取足量数据：个人收藏通常不会超过 100 条
        const res: any = await getFavoriteListApi({ page: 1, pageSize: 100 });
        if (res?.code === 200 && Array.isArray(res.data?.list)) {
          const list = res.data.list as Favorite[];
          set(s => {
            s.list = list;
            // 同步 codes，保持两个字段一致
            s.codes = list.map(f => f.toolCode);
            s.loading = false;
          });
        } else {
          set(s => {
            s.list = [];
            s.codes = [];
            s.loading = false;
            s.error = res?.message || null;
          });
        }
      } catch (e: any) {
        // eslint-disable-next-line no-console
        console.warn('[useFavoritesStore] fetchList failed:', e);
        set(s => {
          s.loading = false;
          s.error = e?.message || '加载失败';
        });
      }
    },

    fetchCodes: async () => {
      try {
        const res: any = await getFavoriteCodesApi();
        if (res?.code === 200 && Array.isArray(res.data)) {
          set(s => { s.codes = res.data as string[]; });
        }
      } catch (e) {
        // eslint-disable-next-line no-console
        console.warn('[useFavoritesStore] fetchCodes failed:', e);
      }
    },

    addFavorite: async (toolCode) => {
      if (get().codes.includes(toolCode)) return true;
      try {
        const res: any = await addFavoriteApi(toolCode);
        // 成功（201）或已收藏（409）均视为最终处于已收藏态
        if (res?.code === 201 || res?.code === 409) {
          // 乐观更新 codes，list 则异步刷新
          set(s => {
            if (!s.codes.includes(toolCode)) s.codes.push(toolCode);
          });
          // 后台同步最新列表（含 sort/favoritedAt/tool 等完整数据）
          get().fetchList({ silent: true });
          return true;
        }
        return false;
      } catch (e) {
        // eslint-disable-next-line no-console
        console.warn('[useFavoritesStore] addFavorite failed:', e);
        return false;
      }
    },

    removeFavorite: async (toolCode) => {
      try {
        const res: any = await removeFavoriteApi(toolCode);
        if (res?.code === 200 || res?.code === 404) {
          set(s => {
            s.codes = s.codes.filter(c => c !== toolCode);
            s.list = s.list.filter(f => f.toolCode !== toolCode);
          });
          return true;
        }
        return false;
      } catch (e) {
        // eslint-disable-next-line no-console
        console.warn('[useFavoritesStore] removeFavorite failed:', e);
        return false;
      }
    },

    toggleFavorite: async (toolCode) => {
      if (get().codes.includes(toolCode)) {
        const ok = await get().removeFavorite(toolCode);
        return ok ? false : true; // 删除成功 → 当前未收藏；失败 → 保持已收藏
      }
      return await get().addFavorite(toolCode);
    },

    reorder: async (orderedToolCodes) => {
      try {
        const res: any = await reorderFavoritesApi(orderedToolCodes);
        if (res?.code === 200) {
          // 重新拉取列表以获取最新 sort 值与顺序
          await get().fetchList({ silent: true });
          return true;
        }
        return false;
      } catch (e) {
        // eslint-disable-next-line no-console
        console.warn('[useFavoritesStore] reorder failed:', e);
        return false;
      }
    },

    isFavorited: (toolCode) => get().codes.includes(toolCode),

    reset: () => set(() => ({ ...initialState })),
  })),
);
