import request from '@/utils/request';

/** OAuth 客户端凭证（前端 admin 端默认值） */
const PLATFORM = 'admin';
const CLIENT_ID = 'admin_client';
const CLIENT_SECRET = 'ADMIN_SECRET';

/** 登录参数 */
export interface LoginParams {
  username: string;
  password: string;
  clientId?: string;
  clientSecret?: string;
  platform?: string;
}

/** 注册参数 */
export interface RegisterParams {
  username: string;
  email: string;
  password: string;
  nickname?: string;
  clientId?: string;
  platform?: string;
}

/** 刷新 Token 参数 */
export interface RefreshParams {
  refreshToken: string;
}

/**
 * 用户登录
 * POST /api/auth/login
 */
export async function loginApi(params: LoginParams): Promise<ApiResponse<LoginResult>> {
  return request.post('/api/auth/login', {
    data: {
      ...params,
      platform: params.platform || PLATFORM,
      clientId: params.clientId || CLIENT_ID,
      clientSecret: params.clientSecret || CLIENT_SECRET,
    },
  });
}

/**
 * 用户注册
 * POST /api/auth/register
 */
export async function registerApi(params: RegisterParams): Promise<ApiResponse<RegisterResult>> {
  return request.post('/api/auth/register', {
    data: {
      ...params,
      platform: params.platform || PLATFORM,
      clientId: params.clientId || CLIENT_ID,
    },
  });
}

/**
 * 刷新 Token
 * POST /api/auth/refresh
 */
export async function refreshTokenApi(params: RefreshParams): Promise<ApiResponse<LoginResult>> {
  return request.post('/api/auth/refresh', {
    data: params,
  });
}

/**
 * 退出登录
 * POST /api/auth/logout
 */
export async function logoutApi(): Promise<ApiResponse<null>> {
  return request.post('/api/auth/logout', {
    data: {},
  });
}

/**
 * 获取当前用户信息
 * GET /api/users/profile
 */
export async function getUserProfileApi(): Promise<ApiResponse<CurrentUser>> {
  return request.get('/api/users/profile');
}
