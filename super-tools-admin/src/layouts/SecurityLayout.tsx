import React, { useEffect } from 'react';
import { Spin } from 'antd';
import { useSelector, useDispatch, history } from 'umi';
import { isAuthenticated } from '@/utils/authority';
import type { GlobalModelState } from '@/models/global';

/**
 * SecurityLayout — 应用入口鉴权层（L1）
 * - 未登录 → 跳 /login?redirect=...（用 history.replace，不整页刷新）
 * - 已登录但 RBAC 未就绪 → 触发 initRBAC + 渲染 loading
 * - 已登录且 RBAC 就绪 → 渲染 children
 *
 * 改动备注：
 *   - 不再使用 window.location.href，避免整页刷新打断 dva store；
 *     跳登录页时 redirect 仅在不是登录/注册等鉴权页时才追加，避免循环。
 */
const SecurityLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const dispatch = useDispatch();
  const { rbacReady } = useSelector(
    (state: { global: GlobalModelState }) => state.global,
  );

  useEffect(() => {
    if (!isAuthenticated()) {
      const { pathname, search } = window.location;
      const isAuthPage = pathname === '/login' || pathname === '/register';
      const target = isAuthPage
        ? '/login'
        : `/login?redirect=${encodeURIComponent(pathname + search)}`;
      history.replace(target);
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
