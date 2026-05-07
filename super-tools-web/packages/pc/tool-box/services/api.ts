// API 服务层
// 封装 request 工具函数，统一配置 baseURL 和错误处理

import { message } from 'antd';

// 响应数据结构
export interface ApiResponse<T = any> {
  code: number;
  message: string;
  data: T;
}

// 请求配置
interface RequestOptions extends RequestInit {
  params?: Record<string, any>;
  showError?: boolean; // 是否自动显示错误提示，默认 true
}

// 基础 URL
const BASE_URL = process.env.NODE_ENV === 'development' ? '' : '';

/**
 * 统一请求函数
 */
async function request<T = any>(
  url: string,
  options: RequestOptions = {},
): Promise<ApiResponse<T>> {
  const { params, showError = true, ...fetchOptions } = options;

  // 处理 query 参数
  let fullUrl = BASE_URL + url;
  if (params) {
    const queryString = new URLSearchParams(
      Object.entries(params)
        .filter(([, v]) => v !== undefined && v !== null)
        .map(([k, v]) => [k, String(v)]),
    ).toString();
    if (queryString) fullUrl += `?${queryString}`;
  }

  // 默认请求头
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(fetchOptions.headers as Record<string, string>),
  };

  // 携带 token
  const token = localStorage.getItem('token');
  if (token) headers['Authorization'] = `Bearer ${token}`;

  try {
    const response = await fetch(fullUrl, {
      ...fetchOptions,
      headers,
    });

    if (!response.ok) {
      const errorMsg = `请求失败：${response.status} ${response.statusText}`;
      if (showError) message.error(errorMsg);
      throw new Error(errorMsg);
    }

    const data: ApiResponse<T> = await response.json();

    if (data.code !== 200) {
      if (showError) message.error(data.message || '请求失败');
      throw new Error(data.message);
    }

    return data;
  } catch (error) {
    if (error instanceof Error) {
      if (showError && !error.message.includes('请求失败')) {
        message.error('网络错误，请检查网络连接');
      }
    }
    throw error;
  }
}

// ==================== 基础接口 ====================

/** 获取天气信息 */
export const getWeather = () => request('/api/weather');

/** 获取工具列表 */
export const getTools = () => request('/api/tools');

/** 搜索工具 */
export const searchToolsApi = (params: { keyword: string; page?: number; pageSize?: number }) =>
  request('/api/search', { params });

// ==================== 用户认证接口 ====================

export interface RegisterParams {
  username: string;
  email: string;
  password: string;
  nickname?: string;
}

export interface LoginParams {
  /** 用户名或邮箱 */
  account: string;
  password: string;
}

export interface AuthResult {
  token: string;
  expiresIn: number;
  userInfo: {
    id: string;
    username: string;
    nickname: string;
    email: string;
    avatar: string;
    role: string;
    settings: {
      notificationEnabled: boolean;
      theme?: string;
      language?: string;
    };
  };
}

/** 用户注册 */
export const register = (data: RegisterParams) =>
  request<AuthResult>('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify(data),
  });

/** 用户登录 */
export const authLogin = (data: LoginParams) =>
  request<AuthResult>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify(data),
  });

/** 获取用户 Profile */
export const getUserProfile = () => request<AuthResult['userInfo']>('/api/user/profile');

/** 更新用户设置 */
export const updateUserSettings = (settings: Record<string, any>) =>
  request('/api/user/settings', {
    method: 'PUT',
    body: JSON.stringify(settings),
  });

// ==================== 公告接口 ====================

export interface Announcement {
  id: string;
  title: string;
  content: string;
  publishTime: string;
  targetAudience: 'all' | 'registered';
  isActive: boolean;
  isRead: boolean;
}

/** 获取公告列表 */
export const getAnnouncementList = () =>
  request<Announcement[]>('/api/announcements/list', { showError: false });

/** 获取未读公告 */
export const getUnreadAnnouncements = () =>
  request<Announcement[]>('/api/announcements/unread', { showError: false });

/** 标记公告已读 */
export const markAnnouncementRead = (announcementId: string) =>
  request('/api/announcements/mark-read', {
    method: 'POST',
    body: JSON.stringify({ announcementId }),
    showError: false,
  });

// 旧版接口（兼容）
export const login = (data: { username: string; password: string }) =>
  request('/api/login', { method: 'POST', body: JSON.stringify(data) });

export const getUserInfo = () => request('/api/user/info');

export default request;
