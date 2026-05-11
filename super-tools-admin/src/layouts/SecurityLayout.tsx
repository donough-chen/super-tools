import React, { useEffect } from 'react';
import { Spin } from 'antd';
import { useSelector, useDispatch } from 'umi';
import { isAuthenticated } from '@/utils/authority';
import type { GlobalModelState } from '@/models/global';

/**
 * SecurityLayout — 应用入口鉴权层（L1）
 * - 未登录 → 跳 /login?redirect=...
 * - 已登录但 RBAC 未就绪 → 触发 initRBAC + 渲染 loading
 * - 已登录且 RBAC 就绪 → 渲染 children
 */
const SecurityLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const dispatch = useDispatch();
  const { rbacReady } = useSelector(
    (state: { global: GlobalModelState }) => state.global,
  );

  useEffect(() => {
    if (!isAuthenticated()) {
      const currentPath = window.location.pathname + window.location.search;
      window.location.href = `/login?redirect=${encodeURIComponent(currentPath)}`;
      return;
    }
    if (!rbacReady) {
      dispatch({ type: 'global/initRBAC' });
    }
  }, [rbacReady, dispatch]);

  if (!isAuthenticated()) return null;

  if (!rbacReady) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <Spin size="large" tip="加载中..." />
      </div>
    );
  }

  return <>{children}</>;
};

export default SecurityLayout;
