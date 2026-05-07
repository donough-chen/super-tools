import React from 'react';

/**
 * 路由懒加载占位组件
 * 在动态加载页面时显示 loading 状态
 */
const Loading: React.FC = () => {
  return (
    <div className="loading-container">
      <div className="loading-spinner" />
    </div>
  );
};

export default Loading;
