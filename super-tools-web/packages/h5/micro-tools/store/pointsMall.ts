/**
 * 积分商城 Store
 *
 * - items / orders 各 5 分钟 TTL 缓存
 * - itemDetailCache 维护商品详情快照（优先 items.find）
 * - exchange 成功后强刷 useMemberStore + ordersFetchedAt=0 失效订单缓存
 *
 * Plan: Task 1.11
 */
import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import {
  getMallItems,
  getMallOrders,
  exchangeItem,
  getUserCoupons,
} from '../service/pointsMall';
import { genIdemKey } from '../utils/idempotency';
import { useMemberStore } from './member';
import type {
  MallItem,
  MallOrder,
  MallOrderStatus,
  ExchangeResult,
  MallItemCategory,
  UserCoupon,
} from '../types/points';
import { getUnlockedTools } from '../service/pointsMall';

const CACHE_TTL = 5 * 60 * 1000;

interface PointsMallState {
  items: MallItem[];
  itemsLoading: boolean;
  itemsFetchedAt: number;
  itemDetailCache: Record<number, MallItem>;
  orders: MallOrder[];
  ordersLoading: boolean;
  ordersFetchedAt: number;
  orderStatusFilter: MallOrderStatus | 'all';
  exchanging: boolean;
  coupons: UserCoupon[];
  couponsLoading: boolean;
  couponsFetchedAt: number;
  unlockedTools: string[];
  unlockedToolsFetchedAt: number;
}

interface PointsMallActions {
  fetchItems: (force?: boolean, category?: MallItemCategory) => Promise<void>;
  fetchItemDetail: (id: number) => Promise<MallItem | null>;
  exchange: (itemId: number) => Promise<ExchangeResult | null>;
  fetchOrders: (
    force?: boolean,
    status?: MallOrderStatus | 'all',
  ) => Promise<void>;
  fetchCoupons: (force?: boolean, status?: 'unused' | 'used' | 'expired' | 'all') => Promise<void>;
  fetchUnlockedTools: (force?: boolean) => Promise<void>;
  reset: () => void;
}

const initialState: PointsMallState = {
  items: [],
  itemsLoading: false,
  itemsFetchedAt: 0,
  itemDetailCache: {},
  orders: [],
  ordersLoading: false,
  ordersFetchedAt: 0,
  orderStatusFilter: 'all',
  exchanging: false,
  coupons: [],
  couponsLoading: false,
  couponsFetchedAt: 0,
  unlockedTools: [],
  unlockedToolsFetchedAt: 0,
};

export const usePointsMallStore = create<
  PointsMallState & PointsMallActions
>()(
  immer((set, get) => ({
    ...initialState,

    fetchItems: async (force = false, category) => {
      const { itemsFetchedAt, items } = get();
      if (!force && items.length && Date.now() - itemsFetchedAt < CACHE_TTL)
        return;
      set((s) => {
        s.itemsLoading = true;
      });
      try {
        const res: any = await getMallItems({ pageSize: 50, category });
        if (res?.code === 200 && res.data) {
          set((s) => {
            s.items = res.data.list || [];
            s.itemsFetchedAt = Date.now();
            s.itemsLoading = false;
            for (const it of s.items) s.itemDetailCache[it.id] = it;
          });
        } else {
          set((s) => {
            s.itemsLoading = false;
          });
        }
      } catch (e) {
        // eslint-disable-next-line no-console
        console.warn('[usePointsMallStore] fetchItems failed:', e);
        set((s) => {
          s.itemsLoading = false;
        });
      }
    },

    fetchItemDetail: async (id: number) => {
      const cached = get().itemDetailCache[id];
      if (cached) return cached;
      const inList = get().items.find((x) => x.id === id);
      if (inList) {
        set((s) => {
          s.itemDetailCache[id] = inList;
        });
        return inList;
      }
      // 后端无单独详情接口；触发列表拉取后再查缓存
      await get().fetchItems(true);
      return get().itemDetailCache[id] || null;
    },

    exchange: async (itemId: number) => {
      if (get().exchanging) return null;
      set((s) => {
        s.exchanging = true;
      });
      try {
        const idemKey = genIdemKey();
        const res: any = await exchangeItem(itemId, idemKey);
        if (res?.code === 200 && res.data) {
          set((s) => {
            s.exchanging = false;
            s.ordersFetchedAt = 0; // 失效订单缓存
          });
          await useMemberStore.getState().fetchMemberInfo(true);
          return res.data as ExchangeResult;
        }
        set((s) => {
          s.exchanging = false;
        });
        throw new Error(res?.message || '兑换失败');
      } catch (e: any) {
        set((s) => {
          s.exchanging = false;
        });
        throw e;
      }
    },

    fetchOrders: async (force = false, status = 'all') => {
      const { ordersFetchedAt, orders, orderStatusFilter } = get();
      const statusChanged = orderStatusFilter !== status;
      if (
        !force &&
        !statusChanged &&
        orders.length &&
        Date.now() - ordersFetchedAt < CACHE_TTL
      ) {
        return;
      }
      set((s) => {
        s.ordersLoading = true;
        s.orderStatusFilter = status;
      });
      try {
        const res: any = await getMallOrders({
          pageSize: 50,
          status: status === 'all' ? undefined : status,
        });
        if (res?.code === 200 && res.data) {
          set((s) => {
            s.orders = res.data.list || [];
            s.ordersFetchedAt = Date.now();
            s.ordersLoading = false;
          });
        } else {
          set((s) => {
            s.ordersLoading = false;
          });
        }
      } catch (e) {
        // eslint-disable-next-line no-console
        console.warn('[usePointsMallStore] fetchOrders failed:', e);
        set((s) => {
          s.ordersLoading = false;
        });
      }
    },

    reset: () => set(() => ({ ...initialState })),

    fetchCoupons: async (force = false, status: 'unused' | 'used' | 'expired' | 'all' = 'unused') => {
      const { couponsFetchedAt, coupons } = get();
      if (!force && coupons.length && Date.now() - couponsFetchedAt < CACHE_TTL) return;
      set((s) => { s.couponsLoading = true; });
      try {
        const res: any = await getUserCoupons(status);
        if (res?.code === 200 && res.data) {
          set((s) => {
            s.coupons = res.data || [];
            s.couponsFetchedAt = Date.now();
            s.couponsLoading = false;
          });
        } else {
          set((s) => { s.couponsLoading = false; });
        }
      } catch (e) {
        console.warn('[usePointsMallStore] fetchCoupons failed:', e);
        set((s) => { s.couponsLoading = false; });
      }
    },

    fetchUnlockedTools: async (force = false) => {
      const { unlockedToolsFetchedAt, unlockedTools } = get();
      if (!force && unlockedTools.length && Date.now() - unlockedToolsFetchedAt < CACHE_TTL) return;
      try {
        const res: any = await getUnlockedTools();
        if (res?.code === 200 && res.data) {
          set((s) => {
            s.unlockedTools = res.data || [];
            s.unlockedToolsFetchedAt = Date.now();
          });
        }
      } catch (e) {
        console.warn('[usePointsMallStore] fetchUnlockedTools failed:', e);
      }
    },
  })),
);
