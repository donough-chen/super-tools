// 用户状态管理（Zustand + immer）
import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { persist } from 'zustand/middleware';

/** 用户设置 */
export interface UserSettings {
  /** 是否接收更新通知，默认 true */
  notificationEnabled: boolean;
  /** 主题偏好 */
  theme?: string;
  /** 语言偏好 */
  language?: string;
}

/** 用户信息 */
export interface UserInfo {
  id: string;
  username: string;
  nickname: string;
  email: string;
  avatar: string;
  role: string;
  settings: UserSettings;
}

/** 默认用户设置 */
const DEFAULT_SETTINGS: UserSettings = {
  notificationEnabled: true,
  theme: 'light',
  language: 'zh-CN',
};

/** 本地缓存 key */
const SETTINGS_CACHE_KEY = 'super_tools_guest_settings';
const SETTINGS_CACHE_TTL = 7 * 24 * 60 * 60 * 1000; // 7天

/** 读取游客本地设置 */
const loadGuestSettings = (): UserSettings => {
  try {
    const raw = localStorage.getItem(SETTINGS_CACHE_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    const { data, expireAt } = JSON.parse(raw);
    if (Date.now() > expireAt) {
      localStorage.removeItem(SETTINGS_CACHE_KEY);
      return { ...DEFAULT_SETTINGS };
    }
    return { ...DEFAULT_SETTINGS, ...data };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
};

/** 保存游客本地设置 */
export const saveGuestSettings = (settings: Partial<UserSettings>) => {
  try {
    const current = loadGuestSettings();
    const merged = { ...current, ...settings };
    localStorage.setItem(
      SETTINGS_CACHE_KEY,
      JSON.stringify({ data: merged, expireAt: Date.now() + SETTINGS_CACHE_TTL }),
    );
    return merged;
  } catch {
    return loadGuestSettings();
  }
};

interface UserState {
  /** 当前登录用户信息，null 表示未登录 */
  userInfo: UserInfo | null;
  /** 当前生效的用户设置（登录用户取服务端，游客取本地缓存） */
  settings: UserSettings;
  /** 是否已完成初始化 */
  initialized: boolean;
}

interface UserActions {
  /** 登录成功后设置用户信息 */
  setUserInfo: (userInfo: UserInfo) => void;
  /** 退出登录 */
  logout: () => void;
  /** 更新设置（同时同步到本地缓存或服务端） */
  updateSettings: (settings: Partial<UserSettings>) => void;
  /** 初始化（从 localStorage 恢复登录态） */
  init: () => void;
}

export const useUserStore = create<UserState & UserActions>()(
  immer(
    persist(
      (set, get) => ({
        userInfo: null,
        settings: loadGuestSettings(),
        initialized: false,

        setUserInfo: (userInfo: UserInfo) => {
          set((state) => {
            state.userInfo = userInfo;
            // 登录后使用服务端设置
            state.settings = { ...DEFAULT_SETTINGS, ...userInfo.settings };
            state.initialized = true;
          });
        },

        logout: () => {
          localStorage.removeItem('token');
          localStorage.removeItem('token_expire');
          set((state) => {
            state.userInfo = null;
            state.settings = loadGuestSettings();
          });
        },

        updateSettings: (newSettings: Partial<UserSettings>) => {
          set((state) => {
            Object.assign(state.settings, newSettings);
          });
          const { userInfo } = get();
          if (!userInfo) {
            // 游客：保存到本地缓存
            saveGuestSettings(newSettings);
          }
          // 登录用户：由调用方负责调用 API 同步到服务端
        },

        init: () => {
          const token = localStorage.getItem('token');
          const expireAt = localStorage.getItem('token_expire');
          if (!token || (expireAt && Date.now() > Number(expireAt))) {
            localStorage.removeItem('token');
            localStorage.removeItem('token_expire');
          }
          set((state) => {
            state.initialized = true;
            if (!state.userInfo) {
              state.settings = loadGuestSettings();
            }
          });
        },
      }),
      {
        name: 'super_tools_user',
        // 只持久化 userInfo，settings 由 init 重新计算
        partialize: (state) => ({ userInfo: state.userInfo }),
      },
    ),
  ),
);
