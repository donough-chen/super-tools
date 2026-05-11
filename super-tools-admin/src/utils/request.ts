import { extend, ResponseError } from 'umi-request';
import { notification } from 'antd';
import { getAccessToken, clearAuth } from './authority';

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

/** 错误处理器 */
const errorHandler = (error: ResponseError) => {
  const { response, data } = error;

  if (response?.status === HttpCode.UNAUTHORIZED) {
    notification.error({ message: '登录已过期，请重新登录' });
    clearAuth();
    if (window.location.pathname !== '/login') {
      window.location.href = '/login';
    }
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

/** 创建请求实例 */
const request = extend({
  prefix: '',
  errorHandler,
  credentials: 'omit',
});

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

/** 响应拦截器：统一处理 code */
request.interceptors.response.use(async (response) => {
  // 非 JSON 响应直接返回
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    return response;
  }

  const data = await response.clone().json();

  if (response.status >= 200 && response.status < 300) {
    return response;
  }

  return response;
});

export default request;
