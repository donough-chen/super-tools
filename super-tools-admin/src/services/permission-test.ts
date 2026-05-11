import request from '@/utils/request';
import type { PermissionTreeNode } from './permission';

// ==================== 类型定义 ====================

export type TestMode = 'user-overview' | 'user-check' | 'role-check';

export interface UserOverviewQuery {
  mode: 'user-overview';
  userId: number;
}

export interface UserCheckByCodeQuery {
  mode: 'user-check';
  userId: number;
  code: string;
}

export interface UserCheckByApiQuery {
  mode: 'user-check';
  userId: number;
  path: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
}

export type UserCheckQuery = UserCheckByCodeQuery | UserCheckByApiQuery;

export interface RoleCheckQuery {
  mode: 'role-check';
  roleCode?: string;
  roleId?: number;
}

export type PermissionTestQuery =
  | UserOverviewQuery
  | UserCheckQuery
  | RoleCheckQuery;

// ==================== Response 类型 ====================

export type DenyReason =
  | 'user_not_found'
  | 'user_disabled'
  | 'no_roles'
  | 'permission_not_exists'
  | 'permission_disabled'
  | 'permission_not_granted';

export interface UserOverviewResult {
  user: { id: number; username: string; nickname?: string; status: 0 | 1 };
  roles: Array<{ id: number; code: string; name: string }>;
  isSuperAdmin: boolean;
  permissionCodes: string[];
  menus: any[];
  stats: {
    totalCodes: number;
    totalMenus: number;
    byModule: Record<string, number>;
  };
}

export interface UserCheckResult {
  user: { id: number; username: string };
  target: {
    type: 'code' | 'api';
    code?: string;
    path?: string;
    method?: string;
    permissionExists: boolean;
    permissionId?: number;
    permissionName?: string;
  };
  allowed: boolean;
  matchedRoles: Array<{ id: number; code: string; name: string }>;
  matchedPermissions: Array<{ id: number; code: string; via: string }>;
  denyReason: DenyReason | null;
}

export interface RoleCheckResult {
  role: { id: number; code: string; name: string };
  permissionTree: PermissionTreeNode[];
  permissionCount: number;
  affectedUsers: Array<{ id: number; username: string; nickname?: string }>;
  totalAffectedCount: number;
}

// ==================== API 封装 ====================

/** 权限测试综合接口（一个 endpoint，按 mode 分发） */
export async function runPermissionTest(query: PermissionTestQuery) {
  return request('/api/admin/permissions/test', { params: query });
}

// ==================== 辅助常量 ====================

/** denyReason 中文映射（UserCheckTab 用） */
export const DENY_REASON_MAP: Record<DenyReason, string> = {
  user_not_found: '用户不存在',
  user_disabled: '用户已停用',
  no_roles: '用户未绑定任何角色',
  permission_not_exists: '权限码 / 接口未注册',
  permission_disabled: '权限码已停用',
  permission_not_granted: '用户的角色未被授予该权限',
};
