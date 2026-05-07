import React, { useEffect, useState } from 'react';
import { Spin } from 'antd';
import { isAuthenticated } from '@/utils/authority';

/**
 * SecurityLayout — 登录鉴权层
 * 检查是否有有效的 Token，未登录跳转登录页
 */
const SecurityLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const authenticated = isAuthenticated();
    if (!authenticated) {
      const currentPath = window.location.pathname + window.location.search;
      window.location.href = `/login?redirect=${encodeURIComponent(currentPath)}`;
      return;
    }
    setIsReady(true);
  }, []);

  if (!isReady) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <Spin size="large" tip="加载中..." />
      </div>
    );
  }

  return <>{children}</>;
};

export default SecurityLayout;
