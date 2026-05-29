/**
 * 积分流水 Store
 *
 * - 分页加载 + 类型/时间筛选
 * - setFilter 切换筛选条件 → 自动 reset 重拉
 * - 派生：即将过期 / 月度构成（在组件内 useMemo 计算）
 *
 * Plan: Task 1.10
 */
import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { getPointsLogs } from '../service/member';
import type { PointsLog, PointsLogType } from '../types/points';

export type DateRangeKey = 'thisMonth' | 'lastMonth' | 'last3Months' | 'all';

export interface PointsLogFilter {
  type?: PointsLogType | 'all';
  range?: DateRangeKey;
}

interface PointsLogState {
  logs: PointsLog[];
  total: number;
  page: number;
  pageSize: number;
  filter: PointsLogFilter;
  loading: boolean;
  hasMore: boolean;
}

interface PointsLogActions {
  fetchLogs: (reset?: boolean) => Promise<void>;
  setFilter: (filter: PointsLogFilter) => Promise<void>;
  loadMore: () => Promise<void>;
  reset: () => void;
}

const initialState: PointsLogState = {
  logs: [],
  total: 0,
  page: 0,
  pageSize: 20,
  filter: { type: 'all', range: 'thisMonth' },
  loading: false,
  hasMore: true,
};

/** DateRangeKey → startDate/endDate（YYYY-MM-DD） */
const resolveRange = (
  range?: DateRangeKey,
): { startDate?: string; endDate?: string } => {
  if (!range || range === 'all') return {};
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const fmt = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  if (range === 'thisMonth') {
    return { startDate: fmt(new Date(y, m, 1)), endDate: fmt(new Date(y, m + 1, 0)) };
  }
  if (range === 'lastMonth') {
    return { startDate: fmt(new Date(y, m - 1, 1)), endDate: fmt(new Date(y, m, 0)) };
  }
  if (range === 'last3Months') {
    return { startDate: fmt(new Date(y, m - 2, 1)), endDate: fmt(new Date(y, m + 1, 0)) };
  }
  return {};
};

export const usePointsLogStore = create<PointsLogState & PointsLogActions>()(
  immer((set, get) => ({
    ...initialState,

    fetchLogs: async (reset = false) => {
      const state = get();
      if (state.loading) return;
      const nextPage = reset ? 1 : state.page + 1;
      set((s) => {
        s.loading = true;
        if (reset) {
          s.logs = [];
          s.page = 0;
          s.hasMore = true;
        }
      });
      try {
        const { type, range } = state.filter;
        const params = {
          page: nextPage,
          pageSize: state.pageSize,
          type: type === 'all' ? undefined : type,
          ...resolveRange(range),
        };
        const res: any = await getPointsLogs(params);
        if (res?.code === 200 && res.data) {
          const list: PointsLog[] = res.data.list || [];
          const total: number = res.data.total ?? list.length;
          set((s) => {
            s.logs = reset ? list : [...s.logs, ...list];
            s.total = total;
            s.page = nextPage;
            s.hasMore = s.logs.length < total;
            s.loading = false;
          });
        } else {
          set((s) => {
            s.loading = false;
          });
        }
      } catch (e) {
        // eslint-disable-next-line no-console
        console.warn('[usePointsLogStore] fetchLogs failed:', e);
        set((s) => {
          s.loading = false;
        });
      }
    },

    setFilter: async (filter: PointsLogFilter) => {
      set((s) => {
        s.filter = { ...s.filter, ...filter };
      });
      await get().fetchLogs(true);
    },

    loadMore: async () => {
      const { hasMore, loading } = get();
      if (!hasMore || loading) return;
      await get().fetchLogs(false);
    },

    reset: () => set(() => ({ ...initialState })),
  })),
);
