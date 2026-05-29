/**
 * 任务中心 Store
 *
 * - 5 分钟 TTL 缓存任务列表
 * - claimTask 成功后局部更新 status='claimed' + 强刷 useMemberStore
 * - 派生 selectGroupedTasks（按 type 分组）供任务中心 4 Tab 使用
 *
 * Plan: Task 1.9
 */
import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { getTasks, claimTask as claimTaskApi } from '../service/task';
import { genIdemKey } from '../utils/idempotency';
import { useMemberStore } from './member';
import type { TaskItem, TaskType, TaskClaimResult } from '../types/points';

const CACHE_TTL = 5 * 60 * 1000;

interface TaskState {
  tasks: TaskItem[];
  loading: boolean;
  fetchedAt: number;
  claimingCode: string | null;
}

interface TaskActions {
  fetchTasks: (force?: boolean) => Promise<void>;
  claimTask: (code: string) => Promise<TaskClaimResult | null>;
  reset: () => void;
}

const initialState: TaskState = {
  tasks: [],
  loading: false,
  fetchedAt: 0,
  claimingCode: null,
};

export const useTaskStore = create<TaskState & TaskActions>()(
  immer((set, get) => ({
    ...initialState,

    fetchTasks: async (force = false) => {
      const { fetchedAt, tasks } = get();
      if (!force && tasks.length && Date.now() - fetchedAt < CACHE_TTL) return;
      set((s) => {
        s.loading = true;
      });
      try {
        const res: any = await getTasks();
        if (res?.code === 200 && res.data) {
          const list: TaskItem[] = Array.isArray(res.data)
            ? res.data
            : res.data.list || [];
          set((s) => {
            s.tasks = list;
            s.fetchedAt = Date.now();
            s.loading = false;
          });
        } else {
          set((s) => {
            s.loading = false;
          });
        }
      } catch (e) {
        // eslint-disable-next-line no-console
        console.warn('[useTaskStore] fetchTasks failed:', e);
        set((s) => {
          s.loading = false;
        });
      }
    },

    claimTask: async (code: string) => {
      if (get().claimingCode) return null;
      set((s) => {
        s.claimingCode = code;
      });
      try {
        const idemKey = genIdemKey();
        const res: any = await claimTaskApi(code, idemKey);
        if (res?.code === 200 && res.data) {
          set((s) => {
            const t = s.tasks.find((x) => x.code === code);
            if (t) t.status = 'claimed';
            s.claimingCode = null;
          });
          await useMemberStore.getState().fetchMemberInfo(true);
          return res.data as TaskClaimResult;
        }
        set((s) => {
          s.claimingCode = null;
        });
        throw new Error(res?.message || '领取失败');
      } catch (e: any) {
        set((s) => {
          s.claimingCode = null;
        });
        throw e;
      }
    },

    reset: () => set(() => ({ ...initialState })),
  })),
);

/** 派生：按类型分组（任务中心 4 Tab 直接消费） */
export const selectGroupedTasks = (
  tasks: TaskItem[],
): Record<TaskType, TaskItem[]> => {
  const groups: Record<TaskType, TaskItem[]> = {
    new_user: [],
    daily: [],
    weekly: [],
    milestone: [],
    activity: [],
  };
  for (const t of tasks) {
    if (groups[t.type]) groups[t.type].push(t);
  }
  return groups;
};
