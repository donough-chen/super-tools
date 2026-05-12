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

/** RBAC 菜单节点（来自后端 GET /api/admin/auth/menus） */
interface MenuNode {
  id: number;
  code: string;
  name: string;
  module: string;
  path: string;
  icon: string | null;
  sort: number;
  /** 节点类型：1=目录（仅做分组容器，无独立页面），2=菜单（叶子或可点击页面） */
  type?: 1 | 2;
  children: MenuNode[];
}
