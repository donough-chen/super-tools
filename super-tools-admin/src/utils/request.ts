import { extend, ResponseError } from 'umi-request';
import { notification } from 'antd';
import { getAccessToken, getRefreshToken, setAuth, clearAuth } from './authority';
import { refreshTokenApi } from '@/services/auth';

/** 业务状态码枚举 */
enum HttpCode {
  SUCCESS = 200,
  CREATED = 201,
  BAD_REQUEST = 400,
  UNAUTHORIZED = 401,
  FORBIDDEN = 403,
  NOT_FOUND = 404,
  VALIDATION_ERROR = 422,
  TOO_MANY_REQUESTS = 429,
  SERVER_ERROR = 500,
}

// ==================== Token 刷新队列 ====================

/** 是否正在刷新 Token */
let isRefreshing = false;

/** 等待刷新完成的请求队列 */
let pendingQueue: Array<{
  resolve: (token: string) => void;
  reject: (err: Error) => void;
}> = [];

/** 刷新完成后，通知队列中所有等待的请求 */
const flushQueue = (token: string | null, error?: Error) => {
  pendingQueue.forEach(({ resolve, reject }) => {
    if (token) resolve(token);
    else reject(error || new Error('Token refresh failed'));
  });
  pendingQueue = [];
};

/**
 * 尝试用 RefreshToken 刷新 AccessToken
 * 成功返回新 AccessToken，失败返回 null
 */
const tryRefreshToken = async (): Promise<string | null> => {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return null;
  try {
    const res = await refreshTokenApi({ refreshToken });
    if (res?.code === 200 && res.data) {
      setAuth({
        accessToken: res.data.accessToken,
        refreshToken: res.data.refreshToken,
        sessionId: res.data.sessionId,
        expiresIn: res.data.expiresIn,
      });
      return res.data.accessToken;
    }
    return null;
  } catch {
    return null;
  }
};

/** 跳转到登录页（防止重复跳转） */
const redirectToLogin = () => {
  clearAuth();
  const onAuthPage =
    window.location.pathname === '/login' ||
    window.location.pathname === '/register';
  if (!onAuthPage) {
    notification.error({ message: '登录已过期，请重新登录' });
    window.location.href = '/login';
  }
};

// ==================== 错误处理器 ====================

/** 错误处理器（处理非 401 的错误；401 由响应拦截器处理） */
const errorHandler = (error: ResponseError) => {
  const { response, data } = error;

  if (response?.status === HttpCode.UNAUTHORIZED) {
    // 401 由响应拦截器处理（含刷新逻辑），此处仅对登录/注册接口的业务 401 透传
    const reqUrl = (response?.url || '') as string;
    const isAuthApi =
      reqUrl.includes('/api/auth/login') ||
      reqUrl.includes('/api/auth/register') ||
      reqUrl.includes('/api/auth/phone-login') ||
      reqUrl.includes('/api/auth/wechat-login');
    if (isAuthApi) {
      throw error;
    }
    // 其他 401 已由响应拦截器处理，此处静默
    return;
  }

  // Spec-B：接口级 403 → notification 提示，不跳转（路由级权限由 AuthWrapper 负责）
  if (response?.status === HttpCode.FORBIDDEN) {
    notification.error({
      message: '操作被拒绝',
      description: data?.message || '当前账号没有此操作权限，请联系管理员',
    });
    return data;
  }

  if (response?.status === HttpCode.VALIDATION_ERROR && data?.errors) {
    notification.error({
      message: '参数验证失败',
      description: Array.isArray(data.errors)
        ? data.errors.map((e: any) => `${e.field}: ${e.message}`).join('; ')
        : JSON.stringify(data.errors),
    });
    return data;
  }

  if (response?.status) {
    notification.error({
      message: `请求错误 ${response.status}`,
      description: data?.message || error.message,
    });
  } else {
    notification.error({ message: '网络异常，请检查网络连接' });
  }

  throw error;
};

// ==================== 请求实例 ====================

/** 创建请求实例 */
const request = extend({
  prefix: '',
  errorHandler,
  credentials: 'omit',
});

// ==================== 请求拦截器 ====================

/** 请求拦截器：注入 Authorization Header */
request.interceptors.request.use((url, options) => {
  const token = getAccessToken();
  if (token) {
    const headers = {
      ...options.headers,
      Authorization: `Bearer ${token}`,
    };
    return { url, options: { ...options, headers } };
  }
  return { url, options };
});

// ==================== 响应拦截器 ====================

/**
 * 响应拦截器：
 * 1. 非 JSON 响应直接返回
 * 2. 401 时尝试刷新 Token（单飞 + 队列化），刷新成功则重试原请求，失败则跳登录页
 */
request.interceptors.response.use(async (response, options: any) => {
  // 非 JSON 响应直接返回
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    return response;
  }

  if (response.status !== HttpCode.UNAUTHORIZED) {
    return response;
  }

  // ===== 401 处理：尝试刷新 Token =====

  const reqUrl: string = options?.url || response.url || '';

  // 登录/注册/刷新接口本身的 401 不走刷新逻辑（业务态错误）
  const isAuthApi =
    reqUrl.includes('/api/auth/login') ||
    reqUrl.includes('/api/auth/register') ||
    reqUrl.includes('/api/auth/phone-login') ||
    reqUrl.includes('/api/auth/wechat-login') ||
    reqUrl.includes('/api/auth/refresh');

  if (isAuthApi) {
    return response;
  }

  // 已标记为重试的请求，避免无限循环
  if (options?.__isRetry) {
    redirectToLogin();
    return response;
  }

  // 多并发：仅第一个请求发起刷新，其他排队等待
  if (isRefreshing) {
    return new Promise<any>((resolve, reject) => {
      pendingQueue.push({
        resolve: (newToken) => {
          const retryOptions = {
            ...options,
            headers: { ...(options.headers || {}), Authorization: `Bearer ${newToken}` },
            __isRetry: true,
          };
          resolve(request(reqUrl, retryOptions));
        },
        reject,
      });
    });
  }

  isRefreshing = true;
  try {
    const newToken = await tryRefreshToken();
    if (!newToken) {
      flushQueue(null, new Error('Token refresh failed'));
      redirectToLogin();
      return response;
    }

    // 刷新成功：通知队列 + 重试当前请求
    flushQueue(newToken);
    const retryOptions = {
      ...options,
      headers: { ...(options.headers || {}), Authorization: `Bearer ${newToken}` },
      __isRetry: true,
    };
    return request(reqUrl, retryOptions);
  } catch (err: any) {
    flushQueue(null, err);
    redirectToLogin();
    return response;
  } finally {
    isRefreshing = false;
  }
});

export default request;
