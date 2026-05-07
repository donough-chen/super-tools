/**
 * 首页 Store
 *
 * 数据来源：
 *  - GET /api/tools/home（聚合模式）— 全量分类 + 每类的工具
 *  - GET /api/tools/feature?pageSize=5 — 特色工具前 5 条做 banner
 *
 * Tab 切换不发请求：toolsByCategory 已含全部数据。
 */
import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { getHome, getFeatureTools } from '../service/tool';
import type { Tool, ToolCategory } from '../types/tool';

interface HomeState {
  /** 全量分类（不含 tools 字段，避免重复存储） */
  categories: ToolCategory[];
  /** 按 categoryCode 分组的工具映射 */
  toolsByCategory: Record<string, Tool[]>;
  /** 首页 banner（特色工具前 5 条） */
  bannerTools: Tool[];
  /** 当前选中的分类码 */
  activeCategoryCode: string;
  loading: boolean;
  error: string | null;
}

interface HomeActions {
  fetchHomeData: () => Promise<void>;
  setActiveCategoryCode: (code: string) => void;
  reset: () => void;
}

const initialState: HomeState = {
  categories: [],
  toolsByCategory: {},
  bannerTools: [],
  activeCategoryCode: '',
  loading: false,
  error: null,
};

export const useHomeStore = create<HomeState & HomeActions>()(
  immer(set => ({
    ...initialState,

    fetchHomeData: async () => {
      set(state => { state.loading = true; state.error = null; });
      try {
        const [homeRes, featureRes]: [any, any] = await Promise.all([
          getHome(),
          getFeatureTools({ page: 1, pageSize: 5 }),
        ]);

        // 聚合模式：拆分 categories 和 toolsByCategory
        if (homeRes?.code === 200 && homeRes.data?.mode === 'aggregate') {
          const aggCats = (homeRes.data.categories || []) as Array<ToolCategory & { tools: Tool[] }>;
          const bucket: Record<string, Tool[]> = {};
          aggCats.forEach(c => { bucket[c.code] = c.tools || []; });
          set(state => {
            state.categories = aggCats.map(({ tools: _t, ...rest }) => rest);
            state.toolsByCategory = bucket;
            if (!state.activeCategoryCode && aggCats.length > 0) {
              state.activeCategoryCode = aggCats[0].code;
            }
          });
        }

        // banner 数据（特色工具）
        if (featureRes?.code === 200 && Array.isArray(featureRes.data?.list)) {
          set(state => { state.bannerTools = featureRes.data.list as Tool[]; });
        } else {
          set(state => { state.bannerTools = []; });
        }

        set(state => { state.loading = false; });
      } catch (e: any) {
        // eslint-disable-next-line no-console
        console.error('[useHomeStore] fetchHomeData failed:', e);
        set(state => { state.loading = false; state.error = e?.message || '加载失败'; });
      }
    },

    setActiveCategoryCode: code => set(state => { state.activeCategoryCode = code; }),

    reset: () => set(() => ({ ...initialState })),
  })),
);
