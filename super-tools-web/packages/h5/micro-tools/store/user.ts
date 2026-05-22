/**
 * 用户 Store（重构版）
 *
 * 职责：
 * - 登录态：登录/注册/登出/初始化恢复
 * - Token 管理：access/refresh 双 token + 自动刷新（拦截器调用本 store 的 refreshToken）
 * - 用户资料：基础（UserInfo） + 扩展（ProfileExtra）
 * - 账号绑定：状态查询、绑定/解绑手机号/邮箱/微信
 * - 密码修改
 * - 当前会话 ID（用于设备管理页标记「本机」）
 *
 * 配套：
 * - useMemberStore 管理会员等级信息
 * - useDeviceStore 管理设备/会话列表
 * - useSendCodeStore 管理验证码倒计时
 */
import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import * as authSvc from '../service/auth';
import * as userSvc from '../service/user';
import { mapErrorCode } from '../utils/errorMap';
import { TOKEN_STORAGE_KEY, SESSION_ID_STORAGE_KEY } from '../constants/oauth';
import type {
  UserInfo, ProfileExtra, BindStatus, StoredTokenData,
  UpdateProfileDTO, ActionResult,
} from '../types/auth';

// ==================== Token 持久化 ====================

const saveToken = (data: StoredTokenData) => {
  try { localStorage.setItem(TOKEN_STORAGE_KEY, JSON.stringify(data)); } catch { /* 静默失败 */ }
};

const loadToken = (): StoredTokenData | null => {
  try {
    const raw = localStorage.getItem(TOKEN_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as StoredTokenData) : null;
  } catch { return null; }
};

const clearToken = () => {
  try {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    localStorage.removeItem(SESSION_ID_STORAGE_KEY);
  } catch { /* 静默失败 */ }
};

/** 提前 60s 视为过期，留出刷新窗口 */
const isTokenExpired = (token: StoredTokenData | null): boolean =>
  !token || Date.now() >= token.expiresAt - 60000;

// ==================== 类型 ====================

interface UserState {
  isLoggedIn: boolean;
  userInfo: UserInfo | null;
  profileExtra: ProfileExtra | null;
  bindStatus: BindStatus | null;
  /** 当前会话 ID（登录时写入，用于设备管理页标记「本机」） */
  currentSessionId: string | null;
  loading: boolean;
  error: string | null;
}

interface UserActions {
  // === 鉴权 ===
  initAuth: () => Promise<void>;
  loginByPassword: (params: { username: string; password: string; captcha?: string }) => Promise<ActionResult>;
  loginByPhone: (params: { phone: string; code: string }) => Promise<ActionResult & { isNewUser?: boolean }>;
  registerByEmail: (params: { username: string; email: string; password: string; nickname?: string }) => Promise<ActionResult>;
  refreshToken: () => Promise<boolean>;
  getAccessToken: () => string | null;
  logout: () => Promise<void>;
  /** 强制重置（不调用 logout 接口，用于 401 刷新失败后清场） */
  reset: () => void;
  // === 资料 ===
  /** 获取当前用户完整资料（基础 + 角色 + 扩展），统一接口 /api/users/profile */
  fetchProfile: () => Promise<void>;
  updateProfile: (dto: UpdateProfileDTO) => Promise<ActionResult>;
  changePassword: (oldPassword: string | undefined, newPassword: string) => Promise<ActionResult>;
  // === 绑定 ===
  fetchBindStatus: () => Promise<void>;
  bindPhone: (phone: string, code: string) => Promise<ActionResult>;
  bindEmail: (email: string, code: string) => Promise<ActionResult>;
  unbind: (type: 'phone' | 'email' | 'wechat', platform?: string) => Promise<ActionResult>;
}

const initialState: UserState = {
  isLoggedIn: false,
  userInfo: null,
  profileExtra: null,
  bindStatus: null,
  currentSessionId: null,
  loading: false,
  error: null,
};

// ==================== 工具 ====================

const handleLoginSuccess = (data: any, set: any) => {
  saveToken({
    accessToken: data.accessToken,
    refreshToken: data.refreshToken,
    expiresAt: Date.now() + data.expiresIn * 1000,
    sessionId: data.sessionId,
  });
  try { localStorage.setItem(SESSION_ID_STORAGE_KEY, data.sessionId); } catch { /* 静默失败 */ }
  set((s: UserState) => {
    s.isLoggedIn = true;
    s.currentSessionId = data.sessionId;
    if (data.user) s.userInfo = data.user;
    s.loading = false;
    s.error = null;
  });
};

const wrapError = (e: any, fallback: string): string =>
  mapErrorCode(
    e?.data?.code || e?.response?.status,
    e?.data?.message || e?.message || fallback,
  );

// ==================== Store ====================

export const useUserStore = create<UserState & UserActions>()(
  immer((set, get) => ({
    ...initialState,

    // ========== 鉴权 ==========

    initAuth: async () => {
      const token = loadToken();
      if (!token) return;
      if (isTokenExpired(token)) {
        const ok = await get().refreshToken();
        if (!ok) { clearToken(); return; }
      } else {
        set(s => {
          s.isLoggedIn = true;
          s.currentSessionId = token.sessionId;
        });
      }
      // 并行拉取资料 + 绑定状态，任一失败不影响其他
      await Promise.allSettled([
        get().fetchProfile(),
        get().fetchBindStatus(),
      ]);
    },

    loginByPassword: async (params) => {
      set(s => { s.loading = true; s.error = null; });
      try {
        const res: any = await authSvc.loginByPassword(params);
        if (res?.code === 200 && res.data) {
          handleLoginSuccess(res.data, set);
          // 后台异步补全资料（不 await，登录立刻返回）
          get().fetchProfile();
          get().fetchBindStatus();
          return { success: true, message: '登录成功' };
        }
        const msg = mapErrorCode(res?.code, res?.message || '登录失败');
        set(s => { s.loading = false; s.error = msg; });
        return { success: false, message: msg };
      } catch (e: any) {
        const msg = wrapError(e, '登录失败，请稍后重试');
        set(s => { s.loading = false; s.error = msg; });
        return { success: false, message: msg };
      }
    },

    loginByPhone: async (params) => {
      set(s => { s.loading = true; s.error = null; });
      try {
        const res: any = await authSvc.loginByPhone(params);
        if (res?.code === 200 && res.data) {
          handleLoginSuccess(res.data, set);
          get().fetchProfile();
          get().fetchBindStatus();
          return {
            success: true,
            message: '登录成功',
            isNewUser: !!res.data.isNewUser,
          };
        }
        const msg = mapErrorCode(res?.code, res?.message || '登录失败');
        set(s => { s.loading = false; s.error = msg; });
        return { success: false, message: msg };
      } catch (e: any) {
        const msg = wrapError(e, '登录失败，请稍后重试');
        set(s => { s.loading = false; s.error = msg; });
        return { success: false, message: msg };
      }
    },

    registerByEmail: async (params) => {
      set(s => { s.loading = true; s.error = null; });
      try {
        const res: any = await authSvc.registerByEmail(params);
        if (res?.code === 201 || res?.code === 200) {
          set(s => { s.loading = false; });
          return { success: true, message: '注册成功，请登录' };
        }
        const msg = mapErrorCode(res?.code, res?.message || '注册失败');
        set(s => { s.loading = false; s.error = msg; });
        return { success: false, message: msg };
      } catch (e: any) {
        const msg = wrapError(e, '注册失败，请稍后重试');
        set(s => { s.loading = false; s.error = msg; });
        return { success: false, message: msg };
      }
    },

    refreshToken: async () => {
      const token = loadToken();
      if (!token?.refreshToken) return false;
      try {
        const res: any = await authSvc.refreshTokenApi(token.refreshToken);
        if (res?.code === 200 && res.data) {
          saveToken({
            accessToken: res.data.accessToken,
            refreshToken: res.data.refreshToken,
            expiresAt: Date.now() + res.data.expiresIn * 1000,
            sessionId: res.data.sessionId,
          });
          set(s => {
            s.isLoggedIn = true;
            s.currentSessionId = res.data.sessionId;
            if (res.data.user) s.userInfo = res.data.user;
          });
          return true;
        }
        return false;
      } catch (e) {
        // eslint-disable-next-line no-console
        console.warn('[useUserStore] refreshToken failed:', e);
        return false;
      }
    },

    getAccessToken: () => {
      const t = loadToken();
      return (!t || isTokenExpired(t)) ? null : t.accessToken;
    },

    logout: async () => {
      try { await authSvc.logoutApi(); } catch { /* 静默失败，仍要清场 */ }
      clearToken();
      set(() => ({ ...initialState }));
    },

    reset: () => {
      clearToken();
      set(() => ({ ...initialState }));
    },

    // ========== 资料 ==========

    fetchProfile: async () => {
      try {
        const res: any = await userSvc.getProfile();
        if (res?.code === 200 && res.data) {
          const { profile, ...userPart } = res.data;
          set(s => {
            // 合并基础字段（避免覆盖现有 userInfo）
            s.userInfo = { ...(s.userInfo || {}), ...userPart } as UserInfo;
            s.profileExtra = profile || null;
            s.isLoggedIn = true;
          });
        }
      } catch (e) {
        // eslint-disable-next-line no-console
        console.warn('[useUserStore] fetchProfile failed:', e);
      }
    },

    updateProfile: async (dto) => {
      try {
        const res: any = await userSvc.updateProfile(dto);
        if (res?.code === 200 && res.data) {
          const { profile, ...userPart } = res.data;
          set(s => {
            s.userInfo = { ...(s.userInfo || {}), ...userPart } as UserInfo;
            if (profile) s.profileExtra = profile;
          });
          return { success: true, message: '保存成功' };
        }
        return {
          success: false,
          message: mapErrorCode(res?.code, res?.message || '保存失败'),
        };
      } catch (e: any) {
        return { success: false, message: wrapError(e, '保存失败') };
      }
    },

    changePassword: async (oldPassword, newPassword) => {
      try {
        const res: any = await userSvc.changePassword(oldPassword, newPassword);
        if (res?.code === 200) {
          return { success: true, message: '密码修改成功' };
        }
        return {
          success: false,
          message: mapErrorCode(res?.code, res?.message || '修改失败'),
        };
      } catch (e: any) {
        return { success: false, message: wrapError(e, '修改失败') };
      }
    },

    // ========== 绑定 ==========

    fetchBindStatus: async () => {
      try {
        const res: any = await authSvc.getBindStatus();
        if (res?.code === 200) {
          set(s => { s.bindStatus = res.data; });
        }
      } catch (e) {
        // eslint-disable-next-line no-console
        console.warn('[useUserStore] fetchBindStatus failed:', e);
      }
    },

    bindPhone: async (phone, code) => {
      try {
        const res: any = await authSvc.bindPhone(phone, code);
        if (res?.code === 200) {
          await get().fetchBindStatus();
          await get().fetchProfile();
          return { success: true, message: '手机号绑定成功' };
        }
        return {
          success: false,
          message: mapErrorCode(res?.code, res?.message || '绑定失败'),
        };
      } catch (e: any) {
        return { success: false, message: wrapError(e, '绑定失败') };
      }
    },

    bindEmail: async (email, code) => {
      try {
        const res: any = await authSvc.bindEmail(email, code);
        if (res?.code === 200) {
          await get().fetchBindStatus();
          await get().fetchProfile();
          return { success: true, message: '邮箱绑定成功' };
        }
        return {
          success: false,
          message: mapErrorCode(res?.code, res?.message || '绑定失败'),
        };
      } catch (e: any) {
        return { success: false, message: wrapError(e, '绑定失败') };
      }
    },

    unbind: async (type, platform) => {
      try {
        const res: any = await authSvc.unbind(type, platform);
        if (res?.code === 200) {
          await get().fetchBindStatus();
          await get().fetchProfile();
          return { success: true, message: '解绑成功' };
        }
        return {
          success: false,
          message: mapErrorCode(res?.code, res?.message || '解绑失败'),
        };
      } catch (e: any) {
        return { success: false, message: wrapError(e, '解绑失败') };
      }
    },
  })),
);
