import type { Effect, ImmerReducer } from 'umi';
import { history } from 'umi';
import { message } from 'antd';
import { loginApi, registerApi, logoutApi, getUserProfileApi } from '@/services/auth';
import {
  setAuth,
  clearAuth,
  setCurrentUser,
  getCurrentUser,
  isAuthenticated,
} from '@/utils/authority';
import { clearRbacCache } from '@/utils/menuCache';

/** 用户状态 */
export interface UserModelState {
  currentUser: CurrentUser | null;
  isLoggedIn: boolean;
  loginLoading: boolean;
  registerLoading: boolean;
}

export interface UserModelType {
  namespace: 'user';
  state: UserModelState;
  effects: {
    login: Effect;
    register: Effect;
    logout: Effect;
    fetchCurrent: Effect;
  };
  reducers: {
    setCurrentUser: ImmerReducer<UserModelState>;
    setLoginLoading: ImmerReducer<UserModelState>;
    setRegisterLoading: ImmerReducer<UserModelState>;
    setLoggedIn: ImmerReducer<UserModelState>;
    reset: ImmerReducer<UserModelState>;
  };
}

const UserModel: UserModelType = {
  namespace: 'user',

  state: {
    currentUser: getCurrentUser(),
    isLoggedIn: isAuthenticated(),
    loginLoading: false,
    registerLoading: false,
  },

  effects: {
    /**
     * 登录
     */
    *login({ payload }, { call, put }) {
      yield put({ type: 'setLoginLoading', payload: true });
      try {
        const response: ApiResponse<LoginResult> = yield call(loginApi, payload);
        if (response?.code === 200 && response.data) {
          // 保存认证信息
          setAuth({
            accessToken: response.data.accessToken,
            refreshToken: response.data.refreshToken,
            sessionId: response.data.sessionId,
          });
          yield put({ type: 'setLoggedIn', payload: true });
          message.success('登录成功');

          // 获取用户信息
          yield put({ type: 'fetchCurrent' });
          // === Spec-B 新增：登录后初始化 RBAC（菜单 + 权限码） ===
          yield put({ type: 'global/initRBAC' });

          // 跳转至首页或回调地址
          const redirect = new URLSearchParams(window.location.search).get('redirect');
          history.replace(redirect || '/');
          return { success: true };
        }
        message.error(response?.message || '登录失败');
        return { success: false, message: response?.message };
      } catch (error: any) {
        const msg = error?.data?.message || error?.message || '登录失败，请重试';
        message.error(msg);
        return { success: false, message: msg };
      } finally {
        yield put({ type: 'setLoginLoading', payload: false });
      }
    },

    /**
     * 注册
     */
    *register({ payload }, { call, put }) {
      yield put({ type: 'setRegisterLoading', payload: true });
      try {
        const response: ApiResponse<RegisterResult> = yield call(registerApi, payload);
        if (response?.code === 201 && response.data) {
          message.success('注册成功，请登录');
          history.push('/login');
          return { success: true, data: response.data };
        }
        message.error(response?.message || '注册失败');
        return { success: false, message: response?.message };
      } catch (error: any) {
        const msg = error?.data?.message || error?.message || '注册失败，请重试';
        message.error(msg);
        return { success: false, message: msg };
      } finally {
        yield put({ type: 'setRegisterLoading', payload: false });
      }
    },

    /**
     * 退出登录
     */
    *logout(_, { call, put }) {
      try {
        yield call(logoutApi);
      } catch {
        // 即使接口调用失败也清除本地状态
      }
      clearAuth();
      // === Spec-B 新增：清 RBAC 缓存与 store 状态 ===
      clearRbacCache();
      yield put({ type: 'global/resetRBAC' });
      yield put({ type: 'reset' });
      history.replace('/login');
      message.success('已退出登录');
    },

    /**
     * 获取当前用户信息
     */
    *fetchCurrent(_, { call, put }) {
      try {
        const response: ApiResponse<CurrentUser> = yield call(getUserProfileApi);
        if (response?.code === 200 && response.data) {
          setCurrentUser(response.data);
          yield put({ type: 'setCurrentUser', payload: response.data });
        }
      } catch {
        // Token 失效等异常，清除登录状态
        clearAuth();
        yield put({ type: 'reset' });
      }
    },
  },

  reducers: {
    setCurrentUser(state, { payload }) {
      state.currentUser = payload;
    },
    setLoginLoading(state, { payload }) {
      state.loginLoading = payload;
    },
    setRegisterLoading(state, { payload }) {
      state.registerLoading = payload;
    },
    setLoggedIn(state, { payload }) {
      state.isLoggedIn = payload;
    },
    reset(state) {
      state.currentUser = null;
      state.isLoggedIn = false;
      state.loginLoading = false;
      state.registerLoading = false;
    },
  },
};

export default UserModel;
