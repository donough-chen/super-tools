/** H5 端 OAuth 客户端凭证（应通过环境变量覆盖，部署前需替换） */
export const H5_CLIENT_ID = 'h5_client';
export const H5_CLIENT_SECRET = 'H5_SECRET';
export const H5_PLATFORM = 'h5';
export const H5_DEVICE_TYPE = 'h5' as const;

/** localStorage 存储 key */
export const TOKEN_STORAGE_KEY = 'super-tools-auth-token';
export const SESSION_ID_STORAGE_KEY = 'super-tools-session-id';
export const DEVICE_ID_STORAGE_KEY = 'super-tools-device-id';

/** 强鉴权路由前缀（未登录时跳 /login） */
export const PROTECTED_PATHS = ['/profile', '/settings', '/favorites', '/member', '/notifications'];

/** 鉴权白名单（请求拦截器跳过 token 注入；响应拦截器跳过 401 自动刷新） */
export const AUTH_WHITELIST = [
  '/api/auth/login',
  '/api/auth/register',
  '/api/auth/refresh',
  '/api/auth/send-code',
  '/api/auth/phone-login',
  '/api/auth/wechat-login',
  '/api/auth/wechat-auth-url',
  '/api/banner/',
  '/api/tool/',
  '/api/site/',
  '/api/featured/',
  '/api/member/levels',
  '/api/member/plans',
];

/** 判断给定 URL 是否在白名单内 */
export const isWhitelisted = (url: string): boolean =>
  AUTH_WHITELIST.some(p => url.startsWith(p));
