/**
 * 设备 / 会话接口模块
 * 设备：/api/users/devices/*
 * 会话：复用 service/auth 中的 getSessions / kickSession（语义归属设备会话域）
 */
import { request } from '@/utils';
import type { DeviceInfo, RegisterDeviceDTO, ApiResult } from '../types/auth';

// 重新导出会话相关接口（语义归属设备会话域）
export { getSessions, kickSession } from './auth';

const API_BASE = '/api';

const postJson = (url: string, data: any) => request.post(url, {
  headers: { 'Content-Type': 'application/json' },
  data: JSON.stringify(data),
});

const putJson = (url: string, data: any) => request.put(url, {
  headers: { 'Content-Type': 'application/json' },
  data: JSON.stringify(data),
});

/** 注册或更新设备（upsert） */
export const registerDevice = (dto: RegisterDeviceDTO): Promise<ApiResult<DeviceInfo>> =>
  postJson(`${API_BASE}/users/devices`, dto);

/** 获取当前用户设备列表 */
export const listDevices = (): Promise<ApiResult<DeviceInfo[]>> =>
  request.get(`${API_BASE}/users/devices`);

/** 移除设备（软删，status=0） */
export const removeDevice = (deviceId: string): Promise<ApiResult<{ message: string }>> =>
  request.delete(`${API_BASE}/users/devices/${encodeURIComponent(deviceId)}`);

/** 更新设备推送开关 */
export const updateDevicePush = (deviceId: string, pushEnabled: boolean): Promise<ApiResult<DeviceInfo>> =>
  putJson(`${API_BASE}/users/devices/${encodeURIComponent(deviceId)}/push`, { pushEnabled });
