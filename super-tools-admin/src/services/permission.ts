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

// 注：本 spec Q3 决策为只读，不暴露 create/update/delete
