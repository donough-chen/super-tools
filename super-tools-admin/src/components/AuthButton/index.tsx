import React from 'react';
import { useSelector } from 'umi';
import { hasPermission } from '@/utils/permission';

interface AuthButtonProps {
  /** 权限码（单个或数组 OR 语义） */
  permCode: string | string[];
  /** 无权限降级展示，默认 null */
  fallback?: React.ReactNode;
  children: React.ReactNode;
}

/**
 * 按钮级权限控制（L4）
 * - 有权限：渲染 children
 * - 无权限：渲染 fallback（默认 null）
 */
const AuthButton: React.FC<AuthButtonProps> = ({ permCode, fallback = null, children }) => {
  const permissions = useSelector((s: any) => s.global.permissions as string[]);
  return hasPermission(permCode, permissions || []) ? <>{children}</> : <>{fallback}</>;
};

export default AuthButton;
