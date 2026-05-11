import request from '@/utils/request';

// ==================== 类型定义 ====================

export interface RoleDTO {
  code: string;            // 角色编码（唯一）
  name: string;            // 角色名称
  description?: string;
  status?: 0 | 1;
  sort?: number;
}

export interface RoleListQuery {
  page?: number;
  pageSize?: number;
  keyword?: string;
  status?: 0 | 1;
}

/** 角色已授权的单个权限（findById include 返回） */
export interface RolePermission {
  id: number;
  code: string;
  name: string;
  type: 1 | 2 | 3 | 4;
}

export interface Role {
  id: number;
  code: string;
  name: string;
  description?: string;
  status: 0 | 1;
  /** 1=系统角色 / 2=自定义；系统角色不可删 */
  type?: 1 | 2;
  sort: number;
  /** findById 时含；list 时不含 */
  permissions?: RolePermission[];
  createdAt?: string;
  updatedAt?: string;
}

// ==================== API 封装 ====================

export async function listRoles(params?: RoleListQuery) {
  return request('/api/admin/roles', { params });
}

export async function getRole(id: number) {
  return request(`/api/admin/roles/${id}`);
}

export async function createRole(data: RoleDTO) {
  return request('/api/admin/roles', { method: 'POST', data });
}

export async function updateRole(id: number, data: Partial<RoleDTO>) {
  return request(`/api/admin/roles/${id}`, { method: 'PUT', data });
}

export async function deleteRole(id: number) {
  return request(`/api/admin/roles/${id}`, { method: 'DELETE' });
}

/**
 * 给角色分配权限（替换式）
 * - body: { permissionIds: number[] }
 * - 仅传叶子节点 ID（type 3=按钮 / 4=API）
 */
export async function assignRolePermissions(id: number, permissionIds: number[]) {
  return request(`/api/admin/roles/${id}/permissions`, {
    method: 'PUT',
    data: { permissionIds },
  });
}
