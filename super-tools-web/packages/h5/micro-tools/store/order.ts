/**
 * 订单 Store
 * 仅缓存"我的订单"列表（避免列表 / 详情页之间重复请求）；
 * 详情走单独 service 调用，避免列表外字段污染。
 */
import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import * as paymentSvc from '../service/payment';
import type { OrderListItem } from '../types/order';

interface OrderState {
  orders: OrderListItem[];
  loading: boolean;
  total: number;
  page: number;
  pageSize: number;
  fetchedAt: number;
}

interface OrderActions {
  fetchMyOrders: (params?: { page?: number; pageSize?: number; status?: number }) => Promise<void>;
  /** 上拉加载更多（追加到 orders 末尾） */
  fetchMoreOrders: (params?: { pageSize?: number; status?: number }) => Promise<boolean>;
  reset: () => void;
}

const initialState: OrderState = {
  orders: [],
  loading: false,
  total: 0,
  page: 1,
  pageSize: 10,
  fetchedAt: 0,
};

export const useOrderStore = create<OrderState & OrderActions>()(
  immer((set, get) => ({
    ...initialState,

    fetchMyOrders: async (params = {}) => {
      const { page = 1, pageSize = 10, status } = params;
      set((s) => { s.loading = true; });
      try {
        const res: any = await paymentSvc.listMyOrders({ page, pageSize, status });
        if (res?.code === 200 && res.data) {
          set((s) => {
            s.orders = res.data.list || [];
            s.total = res.data.total || 0;
            s.page = res.data.page || page;
            s.pageSize = res.data.pageSize || pageSize;
            s.fetchedAt = Date.now();
            s.loading = false;
          });
        } else {
          set((s) => { s.loading = false; });
        }
      } catch (e) {
        // eslint-disable-next-line no-console
        console.warn('[useOrderStore] fetchMyOrders failed:', e);
        set((s) => { s.loading = false; });
      }
    },

    fetchMoreOrders: async (params = {}) => {
      const { pageSize = 10, status } = params;
      const { page, total, orders } = get();
      if (orders.length >= total && total > 0) return false;
      const nextPage = page + 1;
      set((s) => { s.loading = true; });
      try {
        const res: any = await paymentSvc.listMyOrders({ page: nextPage, pageSize, status });
        if (res?.code === 200 && res.data) {
          set((s) => {
            s.orders = [...s.orders, ...(res.data.list || [])];
            s.total = res.data.total || s.total;
            s.page = res.data.page || nextPage;
            s.pageSize = res.data.pageSize || pageSize;
            s.loading = false;
          });
          return true;
        }
        set((s) => { s.loading = false; });
        return false;
      } catch (e) {
        // eslint-disable-next-line no-console
        console.warn('[useOrderStore] fetchMoreOrders failed:', e);
        set((s) => { s.loading = false; });
        return false;
      }
    },

    reset: () => set(() => ({ ...initialState })),
  })),
);
