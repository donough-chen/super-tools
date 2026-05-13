import request from '@/utils/request';

// ==================== 类型定义 ====================

export type PermissionType = 1 | 2 | 3 | 4;
// 1=顶级目录 / 2=菜单 / 3=按钮 / 4=API

export interface Permission {
  id: number;
  code: string;
  name: string;
  type: PermissionType;
  module?: string;
  platform?: string;        // admin / pc / h5 / wechat
  path?: string;
  method?: string;
  parentId: number | null;
  status: 0 | 1;
  sort: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface PermissionTreeNode extends Permission {
  children?: PermissionTreeNode[];
}

// ==================== API 封装 ====================

/** 获取完整权限树 */
export async function getPermissionTree() {
  return request('/api/admin/permissions/tree');
}

/** 单条详情 */
export async function getPermission(id: number) {
  return request(`/api/admin/permissions/${id}`);
}

// ==================== 权限 CRUD ====================

export interface PermissionDTO {
  name: string;
  code: string;
  type: PermissionType;
  module?: string;
  platform?: string;
  path?: string;
  method?: string;
  parentId?: number;
  icon?: string;
  sort?: number;
  status?: 0 | 1;
}

/** 新建权限 */
export async function createPermission(data: PermissionDTO) {
  return request('/api/admin/permissions', { method: 'POST', data });
}

/** 更新权限 */
export async function updatePermission(id: number, data: Partial<PermissionDTO>) {
  return request(`/api/admin/permissions/${id}`, { method: 'PUT', data });
}

/** 删除权限 */
export async function deletePermission(id: number) {
  return request(`/api/admin/permissions/${id}`, { method: 'DELETE' });
}

// ==================== 权限-角色联动 ====================

export interface PermissionHoldersResult {
  permission: Permission;
  roles: Array<{ id: number; code: string; name: string; type: number; status: number }>;
  totalRoles: number;
}

/** 查询拥有指定权限的所有角色 */
export async function getPermissionHolders(id: number) {
  return request(`/api/admin/permissions/${id}/holders`);
}

/** 批量将权限分配给多个角色 */
export async function batchAssignPermToRoles(
  permissionId: number,
  roleIds: number[],
  removeFromRoleIds: number[] = [],
) {
  return request(`/api/admin/permissions/${permissionId}/batch-assign`, {
    method: 'PUT',
    data: { roleIds, removeFromRoleIds },
  });
}

