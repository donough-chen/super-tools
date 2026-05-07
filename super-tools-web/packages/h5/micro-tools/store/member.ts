/**
 * 会员信息 Store
 * 缓存 5 分钟，避免重复请求；profile 卡片、mine 徽标共享同一份数据
 */
import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import * as memberService from '../service/member';
import type { MemberInfo } from '../types/auth';

const CACHE_TTL = 5 * 60 * 1000;

interface MemberState {
  memberInfo: MemberInfo | null;
  loading: boolean;
  fetchedAt: number;
}

interface MemberActions {
  /** 拉取会员信息；force=true 时跳过 TTL 缓存 */
  fetchMemberInfo: (force?: boolean) => Promise<void>;
  reset: () => void;
}

const initialState: MemberState = { memberInfo: null, loading: false, fetchedAt: 0 };

export const useMemberStore = create<MemberState & MemberActions>()(
  immer((set, get) => ({
    ...initialState,

    fetchMemberInfo: async (force = false) => {
      const { fetchedAt, memberInfo } = get();
      if (!force && memberInfo && Date.now() - fetchedAt < CACHE_TTL) return;
      set(s => { s.loading = true; });
      try {
        const res: any = await memberService.getMemberInfo();
        if (res?.code === 200 && res.data) {
          set(s => {
            s.memberInfo = res.data;
            s.fetchedAt = Date.now();
            s.loading = false;
          });
        } else {
          set(s => { s.loading = false; });
        }
      } catch (e) {
        // eslint-disable-next-line no-console
        console.warn('[useMemberStore] fetchMemberInfo failed:', e);
        set(s => { s.loading = false; });
      }
    },

    reset: () => set(() => ({ ...initialState })),
  })),
);
