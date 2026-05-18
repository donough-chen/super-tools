import type { Effect, Reducer } from 'umi';
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
import { resolveSafeRedirect } from '@/utils/redirect';

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
    setCurrentUser: Reducer<UserModelState>;
    setLoginLoading: Reducer<UserModelState>;
    setRegisterLoading: Reducer<UserModelState>;
    setLoggedIn: Reducer<UserModelState>;
    reset: Reducer<UserModelState>;
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
     *
     * 编排：
     *   1. 调 loginApi
     *   2. 写 token / setLoggedIn
     *   3. **等待** fetchCurrent + initRBAC 都完成（避免跳转后立即并发请求出错被
     *      401 拦截器误清 token），任一失败也不阻塞跳转（已记录到 store 的状态
     *      会在新页面里自动刷新）
     *   4. 跳转到 redirect 或 /
     *
     * 偶现 bug 修复：
     *   - 旧实现 fire-and-forget 派发 fetchCurrent + initRBAC + 立即 history.replace，
     *     导致跳转后这两个 effect 才并发执行；任一接口若临时 401（网络抖动 / 服务
     *     端返回慢于跳转），request 拦截器会执行 clearAuth + window.location='/login'，
     *     视觉上"输入对的密码后又被弹回登录页"。
     *   - 这里改成 yield 等待，确保跳转前关键副作用执行完，且把它们对错误的处理
     *     收敛到 effect 内部。
     *   - redirect 参数做白名单兜底，避免诸如 ?redirect=/login 的循环。
     */
    *login({ payload }, { call, put }) {
      yield put({ type: 'setLoginLoading', payload: true });
      try {
        const response: ApiResponse<LoginResult> = yield call(loginApi, payload);
        if (response?.code === 200 && response.data) {
          // 1. 保存认证信息（同步写 localStorage，后续请求拦截器可立即读到）
          setAuth({
            accessToken: response.data.accessToken,
            refreshToken: response.data.refreshToken,
            sessionId: response.data.sessionId,
            expiresIn: response.data.expiresIn,
          });
          yield put({ type: 'setLoggedIn', payload: true });
          message.success('登录成功');

          // 2. 等待用户信息 + RBAC 初始化（任一失败不阻塞跳转）
          //    dva 的 `put` 调用返回 Promise，`yield` 即可等待 effect 完成；
          //    fetchCurrent / initRBAC 内部各自 catch 掉异常，正常情况下不会
          //    抛到这里。即便未来内部行为变更，这里再包一层 try 防御，避免
          //    把"登录后置流程"的异常误判为"登录失败"。
          try {
            yield put({ type: 'fetchCurrent' });
          } catch (e) {
            console.warn('[login] fetchCurrent post-step failed:', e);
          }
          try {
            yield put({ type: 'global/initRBAC' });
          } catch (e) {
            console.warn('[login] initRBAC post-step failed:', e);
          }

          // 3. 计算跳转目标（严格白名单：避免 open-redirect / 登录页循环）
          history.replace(resolveSafeRedirect());
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
     *
     * 注意：catch 里**不再清除认证**。原实现任何异常都 clearAuth() 会与登录后
     * 的并发竞态相互作用，导致"登录成功又被弹回登录页"的偶现 bug。
     *
     * 真正的 401 已由 utils/request.ts 的拦截器统一兜底（清 token + 跳登录），
     * 这里只需吞掉异常即可。
     */
    *fetchCurrent(_, { call, put }) {
      try {
        const response: ApiResponse<CurrentUser> = yield call(getUserProfileApi);
        if (response?.code === 200 && response.data) {
          setCurrentUser(response.data);
          yield put({ type: 'setCurrentUser', payload: response.data });
        }
      } catch (err) {
        // 不主动 clearAuth：避免与登录流程竞态；401 由 request 拦截器处理
        // 其它错误（500 / 网络抖动）允许下次重试
        console.warn('[fetchCurrent] failed:', err);
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
