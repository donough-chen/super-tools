/**
 * API 客户端配置
 * 各端传入自己的请求函数（admin 用 umi-request，h5/pc 用 shared/utils/request）
 */
export interface ApiClientConfig {
  /** 自定义请求函数 */
  request: <T = any>(opts: {
    method: 'GET' | 'POST' | 'PUT' | 'DELETE';
    url: string;
    params?: Record<string, any>;
    data?: any;
  }) => Promise<T>;
}

export function createApiClient(cfg: ApiClientConfig) {
  return cfg;
}
