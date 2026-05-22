/**
 * request 网络请求工具
 * 基于 umi-request 封装，自动注入登录态、签名和验证头
 */
import { extend } from 'umi-request';
import qs from 'query-string';
import { createSig } from './sig';
import appsdk from '../appsdk';

const TGHAPPID = 100001; // 签名 appid（请替换为实际值）
const PRIVATE_KEY = 'your-private-key-here'; // 签名密钥（请替换为实际值）

/** HTTP 状态码说明 */
const codeMessage: Record<number, string> = {
  200: '服务器成功返回请求的数据。',
  201: '新建或修改数据成功。',
  204: '删除数据成功。',
  400: '发出的请求有错误，服务器没有进行操作。',
  401: '用户没有权限（令牌、用户名、密码错误）。',
  403: '用户得到授权，但是访问是被禁止的。',
  404: '发出的请求针对的是不存在的记录。',
  500: '服务器发生错误，请检查服务器。',
  502: '网关错误。',
  503: '服务不可用，服务器暂时过载或维护。',
  504: '网关超时。',
};

/** 统一错误处理 */
const errorHandler = (error: { response: Response }): Response => {
  const { response } = error;
  if (response?.status) {
    const errorText = codeMessage[response.status] || response.statusText;
    console.error(`[Request] 请求错误 ${response.status}: ${response.url} - ${errorText}`);
  } else if (!response) {
    console.error('[Request] 网络异常，无法连接服务器');
  }
  return response;
};

/** 计算签名参数 */
const getSigOptions = (url: string, options: any): any => {
  const parsedUrl = qs.parseUrl(url);
  const pathname = parsedUrl.url.replace(/^https?:\/\/[^/]*/, '');
  const { params, data } = options;
  const method = (options.method || 'GET').toUpperCase();

  if (method === 'GET' || method === 'DELETE') {
    const query = { ...parsedUrl.query, ...params };
    options.params = { ...options.params, sig: createSig(method, pathname, query, PRIVATE_KEY) };
  } else if (data instanceof FormData) {
    const o: Record<string, any> = {};
    for (const [k, v] of data.entries()) o[k] = v;
    options.data.append('sig', createSig(method, pathname, o, PRIVATE_KEY));
  } else if (typeof data === 'string') {
    const sig = createSig(method, pathname, qs.parse(data, { arrayFormat: 'bracket' }), PRIVATE_KEY);
    options.data = `${data}&sig=${sig}`;
  } else if (typeof data === 'object') {
    options.data = { ...data, sig: createSig(method, pathname, data, PRIVATE_KEY) };
  }
  return options;
};


// 请求拦截器：自动注入登录态和签名
import request from 'umi-request';
request.interceptors.request.use((url, options) => {
  const { userId, token } = appsdk.getAppParams();
  const sigParams = options.sig ? { cRand: Date.now(), tghappid: TGHAPPID } : {};

  if (options.method?.toLowerCase() === 'post' && options.noToken !== true) {
    const loginStatus = { userId, token, ...sigParams };

    if (options.data instanceof FormData) {
      for (const [key, val] of Object.entries(loginStatus)) {
        try {
          if (!options.data.get || options.data.get(key) === null) {
            options.data.append(key, val as string);
          }
        } catch {}
      }
    } else if (typeof options.data === 'string') {
      for (const [key, val] of Object.entries(loginStatus)) {
        if (!options.data.includes(key) && val !== undefined) {
          options.data = `${options.data}&${key}=${val}`;
        }
      }
    } else {
      options.data = { ...loginStatus, ...options.data };
    }
  } else {
    options.params = { ...options.params, ...sigParams };
  }

  if (options.sig) {
    Object.assign(options, getSigOptions(url, options));
  }

  return { url, options };
});

const envStag = `${document.cookie}|${window.location.href}`.match(/env-stag=(\w+)/)?.[1];

/** 带验证头的请求实例（默认使用） */
const customRequest = extend({
  errorHandler,
  credentials: 'include',
  headers: {
    ...(process.env.NODE_ENV === 'development' ? { 'env-stag': 'dev' } : {}),
    ...(envStag ? { 'env-stag': envStag } : {}),
  },
});

/** 不带验证头的请求实例 */
export const noVerifyRequest = extend({
  errorHandler,
  credentials: 'include',
});

export default customRequest;
