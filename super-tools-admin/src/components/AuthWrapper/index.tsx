import React from 'react';
import { useSelector, useLocation, Navigate, Outlet } from 'umi';
import { findMenuByPathWithFallback, hasPermission } from '@/utils/permission';
import PageLoading from '@/components/PageLoading';

/**
 * 路由级权限控制（L3）
 * - rbacReady=false → loading
 * - 命中菜单（精确 path 或父目录前缀）+ 有权限 → Outlet
 * - 否则 → /403?required=<code|unmapped:pathname>
 *
 * UmiJS wrappers 用法：
 *   { path: '/x', component: '@/pages/X', wrappers: ['@/components/AuthWrapper'] }
 */
const AuthWrapper: React.FC = () => {
  const { menus, permissions, rbacReady } = useSelector((s: any) => s.global);
  const { pathname } = useLocation();

  if (!rbacReady) return <PageLoading />;

  const node = findMenuByPathWithFallback(menus as MenuNode[], pathname);
  if (!node || !hasPermission(node.code, (permissions as string[]) || [])) {
    const required = node?.code || `unmapped:${pathname}`;
    return <Navigate to={`/403?required=${encodeURIComponent(required)}`} replace />;
  }
  return <Outlet />;
};

export default AuthWrapper;
