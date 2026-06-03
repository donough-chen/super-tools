/**
 * 任务中心 Store
 *
 * - 支持按分类获取任务（利用后端 category 参数）
 * - claimTask 成功后局部更新 status='claimed' + 强刷 useMemberStore
 * - 按当前 activeCategory 存储对应分类的任务列表
 *
 * Plan: Task 1.9
 */
import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { getTasks, claimTask as claimTaskApi } from '../service/task';
import { genIdemKey } from '../utils/idempotency';
import { useMemberStore } from './member';
import type { TaskCategory, TaskItem, TaskClaimResult } from '../types/points';

const CACHE_TTL = 5 * 60 * 1000;

interface TaskState {
  tasksByCategory: Partial<Record<TaskCategory, TaskItem[]>>;
  loading: boolean;
  claimingCode: string | null;
}

interface TaskActions {
  fetchTasks: (category?: TaskCategory, force?: boolean) => Promise<void>;
  claimTask: (code: string) => Promise<TaskClaimResult | null>;
  reset: () => void;
  getTasksByCategory: (category: TaskCategory) => TaskItem[];
}

const initialState: TaskState = {
  tasksByCategory: {},
  loading: false,
  claimingCode: null,
};

export const useTaskStore = create<TaskState & TaskActions>()(
  immer((set, get) => ({
    ...initialState,

    fetchTasks: async (category?: TaskCategory, force = false) => {
      const { tasksByCategory } = get();
      const cached = category ? tasksByCategory[category] : undefined;
      
      if (!force && cached && cached.length && 
          Date.now() - (get() as any).fetchedAt < CACHE_TTL) {
        return;
      }
      
      set((s) => {
        s.loading = true;
      });
      
      try {
        const res: any = await getTasks(category);
        if (res?.code === 200 && res.data) {
          const list: TaskItem[] = Array.isArray(res.data)
            ? res.data
            : res.data.list || [];
          set((s) => {
            if (category) {
              s.tasksByCategory[category] = list;
            } else {
              // 如果没有指定分类，则更新所有分类
              s.tasksByCategory = { ...s.tasksByCategory };
              list.forEach((task) => {
                const cat = task.category;
                if (!s.tasksByCategory[cat]) {
                  s.tasksByCategory[cat] = [];
                }
                const idx = s.tasksByCategory[cat].findIndex((t) => t.code === task.code);
                if (idx >= 0) {
                  s.tasksByCategory[cat][idx] = task;
                } else {
                  s.tasksByCategory[cat].push(task);
                }
              });
            }
            s.loading = false;
            (s as any).fetchedAt = Date.now();
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
            // 更新所有分类中的该任务状态
            Object.keys(s.tasksByCategory).forEach((cat) => {
              const taskList = s.tasksByCategory[cat as TaskCategory];
              if (taskList) {
                const t = taskList.find((x) => x.code === code);
                if (t) t.status = 'claimed';
              }
            });
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

    getTasksByCategory: (category: TaskCategory) => {
      return get().tasksByCategory[category] || [];
    },
  })),
);

/** 兼容性导出：获取所有任务（扁平化） */
export const selectAllTasks = (state: TaskState): TaskItem[] => {
  return Object.values(state.tasksByCategory).flat();
};
