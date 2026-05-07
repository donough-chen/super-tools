/**
 * API 请求层（service.ts）
 * 封装统一请求函数，管理所有接口调用
 */

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
  showError?: boolean;
}

// 基础 URL
const BASE_URL = '';

/**
 * 统一请求函数
 */
async function request<T = any>(
  url: string,
  options: RequestOptions = {},
): Promise<ApiResponse<T>> {
  const { params, showError = true, ...fetchOptions } = options;

  let fullUrl = BASE_URL + url;
  if (params) {
    const queryString = new URLSearchParams(
      Object.entries(params)
        .filter(([, v]) => v !== undefined && v !== null)
        .map(([k, v]) => [k, String(v)]),
    ).toString();
    if (queryString) fullUrl += `?${queryString}`;
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(fetchOptions.headers as Record<string, string>),
  };

  const token = localStorage.getItem('token');
  if (token) headers['Authorization'] = `Bearer ${token}`;

  try {
    const response = await fetch(fullUrl, { ...fetchOptions, headers });

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
    if (error instanceof Error && showError && !error.message.includes('请求失败')) {
      message.error('网络错误，请检查网络连接');
    }
    throw error;
  }
}

// ==================== API 接口封装 ====================

/** 获取天气信息 */
export const getWeather = () => request('/api/weather');

/** 获取工具列表 */
export const getTools = () => request('/api/tools');

/** 用户登录 */
export const login = (data: { username: string; password: string }) =>
  request('/api/login', { method: 'POST', body: JSON.stringify(data) });

/** 获取用户信息 */
export const getUserInfo = () => request('/api/user/info');

/** 搜索工具 */
export const searchToolsApi = (params: { keyword: string; page?: number; pageSize?: number }) =>
  request('/api/search', { params });

export default request;
