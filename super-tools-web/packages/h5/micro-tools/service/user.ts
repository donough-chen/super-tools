/**
 * 用户资料模块
 * 对接：/api/users/profile, /api/users/profile/extra, /api/users/password
 */
import { request } from '@/utils';
import type { UserInfo, FullProfile, UpdateProfileDTO, ApiResult } from '../types/auth';

const API_BASE = '/api';

const putJson = (url: string, data: any) => request.put(url, {
  headers: { 'Content-Type': 'application/json' },
  data: JSON.stringify(data),
});

/** 获取当前用户基础资料 */
export const getProfile = (): Promise<ApiResult<UserInfo>> =>
  request.get(`${API_BASE}/users/profile`);

/** 获取完整资料（基础 + 扩展 profile） */
export const getProfileExtra = (): Promise<ApiResult<FullProfile>> =>
  request.get(`${API_BASE}/users/profile/extra`);

/** 更新用户资料（基础 + 扩展，部分更新） */
export const updateProfile = (dto: UpdateProfileDTO): Promise<ApiResult<FullProfile>> =>
  putJson(`${API_BASE}/users/profile`, dto);

/** 修改/设置密码
 *
 * 当用户已设密码（hasPassword=true）时，oldPassword 必传；
 * 当用户未设密码（如手机号注册首次设置）时，oldPassword 可省略。
 */
export const changePassword = (
  oldPassword: string | undefined,
  newPassword: string,
): Promise<ApiResult<null>> =>
  putJson(`${API_BASE}/users/password`, oldPassword
    ? { oldPassword, newPassword }
    : { newPassword });
