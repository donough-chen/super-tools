/**
 * 鉴权请求拦截器（A 方案：注册到共享 customRequest 实例）
 *
 * 设计要点：
 * 1. 直接在 `@/utils` 导出的 `customRequest` 实例上注册拦截器，
 *    避免污染 `umi-request` 的全局实例
 * 2. 与现有 PCG 鉴权（POST body 注入 userId/token/cGameId/cCurrentGameId）共存：
 *    - 旧逻辑负责 body 中的 PCG 字段（不影响）
 *    - 新逻辑只在白名单外的请求 header 中追加 `Authorization: Bearer <token>`
 *    - 后端可按需要选择校验方式
 * 3. 401 时单飞 + 队列化刷新 token，刷新失败跳 /login
 *
 * 使用：在 layouts/index.tsx 顶部 `import '../utils/authRequest';`
 *      即可触发拦截器注册（副作用导入）
 */
import { request } from '@/utils';
import { navigateReplace, getCurrentPathname } from '@/utils/navigator';
import {
  isWhitelisted,
  TOKEN_STORAGE_KEY,
} from '../constants/oauth';
import type { StoredTokenData } from '../types/auth';

let isRefreshing = false;
let pendingQueue: Array<{
  resolve: (token: string) => void;
  reject: (err: Error) => void;
}> = [];

const flushQueue = (token: string | null, error?: Error) => {
  pendingQueue.forEach(({ resolve, reject }) => {
    if (token) resolve(token);
    else reject(error || new Error('Token refresh failed'));
  });
  pendingQueue = [];
};

const getAccessTokenFromStorage = (): string | null => {
  try {
    const raw = localStorage.getItem(TOKEN_STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as Partial<StoredTokenData>;
    return data.accessToken || null;
  } catch {
    return null;
  }
};

// === 请求拦截：注入 Bearer Token ===
// 注意：customRequest 是 @/utils 导出的 umi-request 扩展实例
request.interceptors.request.use((url: string, options: any) => {
  if (!isWhitelisted(url)) {
    const token = getAccessTokenFromStorage();
    if (token) {
      options.headers = {
        ...(options.headers || {}),
        Authorization: `Bearer ${token}`,
      };
    }
  }
  return { url, options };
});

// === 响应拦截：401 自动刷新 ===
request.interceptors.response.use(async (response: any, options: any) => {
  // umi-request 的 response 拦截器入参为 (response, options)
  // response 通常是 Response 对象（fetch 标准），有 status
  const status = response?.status;
  const reqUrl: string = options?.url || response?.url || '';

  if (status !== 401 || isWhitelisted(reqUrl) || options?.__isRetry) {
    return response;
  }

  // 多并发：仅第一个发起 refresh，其他排队
  if (isRefreshing) {
    // 显式 Promise<any>：umi-request 响应拦截器的类型签名为 Response，
    // 但实际允许返回任意值（库会作为最终 resolve 数据）。
    return new Promise<any>((resolve, reject) => {
      pendingQueue.push({
        resolve: (newToken) => {
          options.headers = { ...(options.headers || {}), Authorization: `Bearer ${newToken}` };
          options.__isRetry = true;
          resolve(request(reqUrl, options));
        },
        reject,
      });
    });
  }

  isRefreshing = true;
  try {
    // 动态加载 useUserStore，避免与 store/user.ts 的循环依赖
    // store/user.ts 通过 service 间接依赖 request，request 不能编译期依赖 store
    // eslint-disable-next-line @typescript-eslint/no-var-requires, global-require
    const { useUserStore } = require('../store/user');
    const ok = await useUserStore.getState().refreshToken();
    if (!ok) throw new Error('refresh failed');

    const newToken = getAccessTokenFromStorage();
    if (!newToken) throw new Error('no token after refresh');

    flushQueue(newToken);
    options.headers = { ...(options.headers || {}), Authorization: `Bearer ${newToken}` };
    options.__isRetry = true;
    return request(reqUrl, options);
  } catch (err: any) {
    flushQueue(null, err);
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires, global-require
      const { useUserStore } = require('../store/user');
      useUserStore.getState().reset();
    } catch { /* store 未就绪 */ }
    const current = getCurrentPathname();
    if (!current.startsWith('/login')) {
      navigateReplace(`/login?redirect=${encodeURIComponent(current)}`);
    }
    return response;
  } finally {
    isRefreshing = false;
  }
});

// 模块加载时打印（便于排查拦截器是否注册成功）
// eslint-disable-next-line no-console
console.log('[authRequest] interceptors registered on customRequest');
