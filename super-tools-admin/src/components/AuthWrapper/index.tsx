import React from 'react';
import { useSelector, useLocation, Redirect } from 'umi';
import { findMenuByPathWithFallback, hasPermission } from '@/utils/permission';
import PageLoading from '@/components/PageLoading';

/**
 * 路由级权限控制（L3）
 * - rbacReady=false → loading
 * - 命中菜单（精确 path 或父目录前缀）+ 有权限 → children
 * - 否则 → /403?required=<code|unmapped:pathname>
 *
 * 路径匹配采用"精确 + 父目录前缀回退"二级策略，兼容数据库菜单未列出的扩展子页。
 *
 * UmiJS wrappers 用法：
 *   { path: '/x', component: '@/pages/X', wrappers: ['@/components/AuthWrapper'] }
 */
const AuthWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { menus, permissions, rbacReady } = useSelector((s: any) => s.global);
  const { pathname } = useLocation();

  if (!rbacReady) return <PageLoading />;

  const node = findMenuByPathWithFallback(menus as MenuNode[], pathname);
  if (!node || !hasPermission(node.code, (permissions as string[]) || [])) {
    const required = node?.code || `unmapped:${pathname}`;
    return <Redirect to={`/403?required=${encodeURIComponent(required)}`} />;
  }
  return <>{children}</>;
};

export default AuthWrapper;
