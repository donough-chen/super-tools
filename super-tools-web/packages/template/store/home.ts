/**
 * 首页 Store（基于 Zustand）
 *
 * 架构优化说明：
 * - 原方案使用 DVA（Redux + Redux-Saga），已停止维护，样板代码多
 * - 新方案使用 Zustand，轻量、无样板代码、支持 async/await
 * - 迁移成本低：useSelector → useHomeStore，dispatch → 直接调用 action
 */
import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { getMockData } from '@/service';

interface HomeState {
  /** 页面数据 */
  data: Record<string, any>;
  /** 加载状态 */
  loading: boolean;
  /** 错误信息 */
  error: string | null;
  /** URL 查询参数 */
  query: Record<string, string>;
}

interface HomeActions {
  /** 初始化 query 参数 */
  initQuery: (query: Record<string, string>) => void;
  /** 获取页面数据 */
  fetchData: (params?: Record<string, any>) => Promise<void>;
  /** 重置状态 */
  reset: () => void;
}

const initialState: HomeState = {
  data: {},
  loading: false,
  error: null,
  query: {},
};

/**
 * 首页状态管理 Store
 *
 * @example
 * const { data, loading, fetchData } = useHomeStore();
 */
export const useHomeStore = create<HomeState & HomeActions>()(
  immer(set => ({
    ...initialState,

    initQuery: query => {
      set(state => {
        state.query = query;
      });
    },

    fetchData: async params => {
      set(state => {
        state.loading = true;
        state.error = null;
      });
      try {
        const result = await getMockData(params);
        set(state => {
          state.data = result || {};
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
