import React from 'react';
import { useSelector, useLocation, Redirect } from 'umi';
import { findMenuByPath, hasPermission } from '@/utils/permission';
import PageLoading from '@/components/PageLoading';

/**
 * 路由级权限控制（L3）
 * - rbacReady=false → loading
 * - 命中菜单 + 有权限 → children
 * - 否则 → /403?required=<code|unmapped:pathname>
 *
 * UmiJS wrappers 用法：
 *   { path: '/x', component: '@/pages/X', wrappers: ['@/components/AuthWrapper'] }
 */
const AuthWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { menus, permissions, rbacReady } = useSelector((s: any) => s.global);
  const { pathname } = useLocation();

  if (!rbacReady) return <PageLoading />;

  const node = findMenuByPath(menus as MenuNode[], pathname);
  if (!node || !hasPermission(node.code, (permissions as string[]) || [])) {
    const required = node?.code || `unmapped:${pathname}`;
    return <Redirect to={`/403?required=${encodeURIComponent(required)}`} />;
  }
  return <>{children}</>;
};

export default AuthWrapper;
