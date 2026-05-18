/**
 * 通知 Store
 *
 * 职责：
 * - 创建并暴露 notification SDK 实例（三端共享 SDK）
 * - 管理未读消息数（初始拉取 + Socket 实时更新）
 * - 在 layout 登录后调用 init() 连接 Socket 并拉取未读数
 * - 提供 refresh() 手动刷新未读数
 * - 提供 destroy() 断开 Socket 连接
 */
import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { createNotificationSdk } from '../../../shared/notification';
import type { NotificationSdk } from '../../../shared/notification';
import { TOKEN_STORAGE_KEY } from '../constants/oauth';

// ==================== SDK 实例（全局单例） ====================

/** 适配 H5 端的请求函数：走 authRequest 拦截器 */
const adaptedRequest = async <T = any>(opts: {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  url: string;
  params?: Record<string, any>;
  data?: any;
}): Promise<T> => {
  // 动态 require 避免循环依赖（authRequest 副作用导入在 layouts 顶部）
  const { request } = require('@/utils');
  const res = await request(opts.url, {
    method: opts.method,
    params: opts.params,
    data: opts.data,
  });
  // H5 端 request 返回的是完整响应 { code, data, message }
  // SDK 期望直接返回 data 部分
  if (res && typeof res === 'object' && 'code' in res) {
    if (res.code === 0 || res.code === 200) {
      return res.data as T;
    }
    throw new Error(res.message || '请求失败');
  }
  return res as T;
};

const getToken = (): string | null => {
  try {
    const raw = localStorage.getItem(TOKEN_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed.accessToken || null;
  } catch {
    return null;
  }
};

const sdk: NotificationSdk = createNotificationSdk({
  api: { request: adaptedRequest },
  socket: {
    url: (typeof window !== 'undefined' ? window.location.origin : '') + '/notification',
    getToken,
  },
});

// ==================== Store ====================

interface NotificationState {
  /** 未读消息数 */
  unreadCount: number;
  /** 是否已初始化 */
  initialized: boolean;
}

interface NotificationActions {
  /** 登录后初始化：连接 Socket + 拉取未读数 */
  init: () => void;
  /** 手动刷新未读数 */
  refresh: () => Promise<void>;
  /** 断开 Socket + 重置状态 */
  destroy: () => void;
  /** 重置状态 */
  reset: () => void;
}

const initialState: NotificationState = {
  unreadCount: 0,
  initialized: false,
};

export const useNotificationStore = create<NotificationState & NotificationActions>()(
  immer((set, get) => ({
    ...initialState,

    init: () => {
      if (get().initialized) return;

      // 连接 Socket
      sdk.socket.connect();

      // 监听未读数实时推送
      sdk.socket.on('notification:unread_count', (payload) => {
        set(state => { state.unreadCount = payload.count; });
      });

      // 拉取初始未读数
      sdk.messages.unreadCount()
        .then((r) => {
          set(state => { state.unreadCount = r.count; });
        })
        .catch(() => {
          // 静默失败（未登录或网络异常）
        });

      set(state => { state.initialized = true; });
    },

    refresh: async () => {
      try {
        const r = await sdk.messages.unreadCount();
        set(state => { state.unreadCount = r.count; });
      } catch {
        // 静默失败
      }
    },

    destroy: () => {
      sdk.socket.disconnect();
      set(() => ({ ...initialState }));
    },

    reset: () => {
      sdk.socket.disconnect();
      set(() => ({ ...initialState }));
    },
  })),
);

/** 导出 SDK 实例供页面直接使用 */
export const notificationSdk = sdk;
