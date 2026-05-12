import request from '@/utils/request';

// ==================== 类型定义 ====================

export interface UserDTO {
  username: string;
  email?: string;
  password: string;
  phone?: string;
  nickname?: string;
}

export interface UserUpdateDTO {
  email?: string;
  phone?: string;
  nickname?: string;
  // 编辑模式不允许改 username（DB 唯一约束）；密码改通过 resetUserPassword
}

export interface UserListQuery {
  page?: number;
  pageSize?: number;
  keyword?: string;
  status?: 0 | 1;
  registerSource?: string;
  startDate?: string;
  endDate?: string;
}

export interface UserRoleBrief {
  id: number;
  name: string;
  code: string;
}

export interface User {
  id: number;
  uuid: string;
  username: string;
  email?: string;
  phone?: string;
  nickname?: string;
  avatar?: string;
  status: 0 | 1;
  /** @deprecated 已废弃，仅保留向后兼容 */
  userType?: number;
  registerSource?: string;
  registerIp?: string;
  gender?: 0 | 1 | 2;
  birthday?: string;
  /** findById 时含；list 时不含 */
  roles?: UserRoleBrief[];
  createdAt?: string;
  updatedAt?: string;
}

export interface UserDevice {
  id: number;
  userId: number;
  deviceId: string;
  deviceName?: string;
  deviceType: string;
  osVersion?: string;
  appVersion?: string;
  pushToken?: string;
  pushEnabled: 0 | 1;
  lastActiveAt: string;
  status: 0 | 1;
  createdAt?: string;
}

export interface UserAddress {
  id: number;
  userId: number;
  receiver: string;
  phone: string;
  province: string;
  city: string;
  district: string;
  address: string;
  isDefault: 0 | 1;
  createdAt?: string;
}

// ==================== API 封装 ====================

/**
 * 用户列表（管理端）
 * - 后端 paginate helper 返回结构：data: { list, total, page, pageSize, totalPages }
 */
export async function listUsers(params?: UserListQuery) {
  return request('/api/users', { params });
}

export async function getUser(id: number) {
  return request(`/api/users/${id}`);
}

export async function createUser(data: UserDTO) {
  return request('/api/users', { method: 'POST', data });
}

export async function updateUser(id: number, data: UserUpdateDTO) {
  return request(`/api/users/${id}`, { method: 'PUT', data });
}

export async function deleteUser(id: number) {
  return request(`/api/users/${id}`, { method: 'DELETE' });
}

// ===== Spec-C2a 新增：管理端用户行为 =====

/** POST /api/admin/users/:id/reset-password — 重置某用户密码（不能改自己） */
export async function resetUserPassword(id: number, newPassword: string) {
  return request(`/api/admin/users/${id}/reset-password`, {
    method: 'POST',
    data: { newPassword },
  });
}

/** PUT /api/admin/users/:id/status — 启用/禁用用户（不能禁自己） */
export async function changeUserStatus(id: number, status: 0 | 1) {
  return request(`/api/admin/users/${id}/status`, {
    method: 'PUT',
    data: { status },
  });
}

/** GET /api/admin/users/:id/devices — admin 查看用户设备列表 */
export async function listUserDevices(id: number) {
  return request(`/api/admin/users/${id}/devices`);
}

/** GET /api/admin/users/:id/addresses — admin 查看用户地址列表 */
export async function listUserAddresses(id: number) {
  return request(`/api/admin/users/${id}/addresses`);
}
