import React from 'react';
import { Spin } from 'antd';

/** 页面加载占位组件 */
const PageLoading: React.FC = () => (
  <div
    style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      height: '100vh',
      width: '100%',
    }}
  >
    <Spin size="large" tip="页面加载中..." />
  </div>
);

export default PageLoading;
