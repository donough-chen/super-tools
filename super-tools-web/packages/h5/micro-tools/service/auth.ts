/**
 * 认证接口模块
 * 对接：/api/auth/*
 * V1 范围：登录（密码/手机号）、注册（邮箱）、Token 刷新、验证码、登出、
 *          会话管理、账号绑定/解绑/绑定状态。微信登录推迟到 V2。
 *
 * 注：accessToken 由 utils/authRequest 拦截器自动注入，service 层无需关心
 */
import { request } from '@/utils';
import { H5_CLIENT_ID, H5_CLIENT_SECRET, H5_PLATFORM } from '../constants/oauth';
import type {
  LoginResponse, RegisterResponse, BindStatus, SessionInfo, ApiResult,
} from '../types/auth';

const API_BASE = '/api';

const postJson = (url: string, data: any) => request.post(url, {
  headers: { 'Content-Type': 'application/json' },
  data: JSON.stringify(data),
});

// ==================== 登录 ====================

/** 账号密码登录（支持用户名/邮箱/手机号） */
export const loginByPassword = (params: {
  username: string; password: string; captcha?: string;
}): Promise<ApiResult<LoginResponse>> =>
  postJson(`${API_BASE}/auth/login`, {
    ...params,
    clientId: H5_CLIENT_ID,
    clientSecret: H5_CLIENT_SECRET,
    platform: H5_PLATFORM,
  });

/** 手机号验证码登录（登录即注册） */
export const loginByPhone = (params: {
  phone: string; code: string;
}): Promise<ApiResult<LoginResponse>> =>
  postJson(`${API_BASE}/auth/phone-login`, {
    ...params,
    clientId: H5_CLIENT_ID,
    clientSecret: H5_CLIENT_SECRET,
    platform: H5_PLATFORM,
  });

// ==================== 注册 ====================

/** 邮箱+密码注册 */
export const registerByEmail = (params: {
  username: string; email: string; password: string; nickname?: string;
}): Promise<ApiResult<RegisterResponse>> =>
  postJson(`${API_BASE}/auth/register`, {
    ...params,
    clientId: H5_CLIENT_ID,
    platform: H5_PLATFORM,
  });

// ==================== Token & 验证码 & 登出 ====================

/** 刷新 Token */
export const refreshTokenApi = (refreshToken: string): Promise<ApiResult<LoginResponse>> =>
  postJson(`${API_BASE}/auth/refresh`, { refreshToken });

/** 发送短信/邮箱验证码 */
export const sendCode = (
  target: string,
  type: 'login' | 'register' | 'reset' | 'bind',
): Promise<ApiResult<{ message: string; expiresIn?: number }>> =>
  postJson(`${API_BASE}/auth/send-code`, { target, type, platform: H5_PLATFORM });

/** 退出登录 */
export const logoutApi = (): Promise<ApiResult<null>> =>
  postJson(`${API_BASE}/auth/logout`, {});

// ==================== 会话管理 ====================

/** 获取当前用户活跃会话列表 */
export const getSessions = (): Promise<ApiResult<SessionInfo[]>> =>
  request.get(`${API_BASE}/auth/sessions`);

/** 踢掉指定会话 */
export const kickSession = (sessionId: string): Promise<ApiResult<null>> =>
  request.delete(`${API_BASE}/auth/sessions/${encodeURIComponent(sessionId)}`);

// ==================== 账号绑定 ====================

/** 绑定手机号 */
export const bindPhone = (phone: string, code: string): Promise<ApiResult<{ message: string }>> =>
  postJson(`${API_BASE}/auth/bind/phone`, { phone, code });

/** 绑定邮箱 */
export const bindEmail = (email: string, code: string): Promise<ApiResult<{ message: string }>> =>
  postJson(`${API_BASE}/auth/bind/email`, { email, code });

/** 解绑账号（手机/邮箱/微信） */
export const unbind = (
  type: 'phone' | 'email' | 'wechat',
  platform?: string,
): Promise<ApiResult<{ message: string }>> =>
  postJson(`${API_BASE}/auth/unbind`, { type, ...(platform ? { platform } : {}) });

/** 获取账号绑定状态 */
export const getBindStatus = (): Promise<ApiResult<BindStatus>> =>
  request.get(`${API_BASE}/auth/bind-status`);

// ==================== V2 预留（微信登录） ====================
// export const loginByWechat = ...;
// export const getWechatAuthUrl = ...;
// export const bindWechat = ...;
