declare module '*.css';
declare module '*.less';
declare module '*.png';
declare module '*.jpg';
declare module '*.gif';
declare module '*.svg';

declare const API_BASE_URL: string;

/** 统一 API 响应结构 */
interface ApiResponse<T = any> {
  code: number;
  message: string;
  data?: T;
  timestamp: number;
  errors?: any[];
}

/** 登录响应数据 */
interface LoginResult {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  sessionId: string;
}

/** 注册响应数据 */
interface RegisterResult {
  id: number;
  uuid: string;
}

/** 用户信息 */
interface CurrentUser {
  id: number;
  uuid: string;
  username: string;
  nickname: string;
  email: string;
  avatar?: string;
  userType?: string;
}
