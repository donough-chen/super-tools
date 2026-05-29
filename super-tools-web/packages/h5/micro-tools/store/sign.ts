/**
 * 签到 Store
 *
 * - 5 分钟 TTL 缓存签到状态
 * - 提交签到成功后强刷 useMemberStore，保证会员中心顶部积分实时更新
 *
 * Plan: Task 1.8
 */
import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { getSignStatus, doSign } from '../service/sign';
import { genIdemKey } from '../utils/idempotency';
import { useMemberStore } from './member';
import type { SignStatus, SignResult } from '../types/points';

const CACHE_TTL = 5 * 60 * 1000;

interface SignState {
  status: SignStatus | null;
  loading: boolean;
  submitting: boolean;
  fetchedAt: number;
}

interface SignActions {
  fetchStatus: (force?: boolean) => Promise<void>;
  submitSign: () => Promise<SignResult | null>;
  reset: () => void;
}

const initialState: SignState = {
  status: null,
  loading: false,
  submitting: false,
  fetchedAt: 0,
};

export const useSignStore = create<SignState & SignActions>()(
  immer((set, get) => ({
    ...initialState,

    fetchStatus: async (force = false) => {
      const { fetchedAt, status } = get();
      if (!force && status && Date.now() - fetchedAt < CACHE_TTL) return;
      set((s) => {
        s.loading = true;
      });
      try {
        const res: any = await getSignStatus();
        if (res?.code === 200 && res.data) {
          set((s) => {
            s.status = res.data;
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
        console.warn('[useSignStore] fetchStatus failed:', e);
        set((s) => {
          s.loading = false;
        });
      }
    },

    submitSign: async () => {
      if (get().submitting) return null;
      set((s) => {
        s.submitting = true;
      });
      try {
        const idemKey = genIdemKey();
        const res: any = await doSign(idemKey);
        if (res?.code === 200 && res.data) {
          set((s) => {
            if (s.status) {
              s.status.signedToday = true;
              s.status.continuousDays = res.data.continuousDays;
            }
            s.submitting = false;
          });
          // 跨 Store 同步：积分变动后强刷会员信息
          await useMemberStore.getState().fetchMemberInfo(true);
          return res.data as SignResult;
        }
        set((s) => {
          s.submitting = false;
        });
        throw new Error(res?.message || '签到失败');
      } catch (e: any) {
        set((s) => {
          s.submitting = false;
        });
        throw e;
      }
    },

    reset: () => set(() => ({ ...initialState })),
  })),
);
