import React, { useEffect } from 'react';
import { Spin } from 'antd';
import { useSelector, useDispatch, history, Outlet } from 'umi';
import { isAuthenticated } from '@/utils/authority';
import type { GlobalModelState } from '@/models/global';

/**
 * SecurityLayout — 应用入口鉴权层（L1）
 * - 未登录 → 跳 /login?redirect=...（用 history.replace，不整页刷新）
 * - 已登录但 RBAC 未就绪 → 触发 initRBAC + 渲染 loading
 * - 已登录且 RBAC 就绪 → 渲染子路由（Outlet）
 */
const SecurityLayout: React.FC = () => {
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
        <Spin size="large" tip="加载中...">
          <div style={{ padding: 50 }} />
        </Spin>
      </div>
    );
  }

  return <Outlet />;
};

export default SecurityLayout;
