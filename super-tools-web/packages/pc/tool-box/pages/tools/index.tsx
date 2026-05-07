import React from 'react';
import { useLocation } from 'umi';
import { Button } from 'antd';
import { ToolOutlined, ArrowLeftOutlined } from '@ant-design/icons';
import { TOOLS_LIST } from '@/utils/toolsData';
import './index.less';

/**
 * 工具页面占位组件
 * 所有"待开发"的工具路由都使用此组件作为占位
 */
const ToolPlaceholder: React.FC = () => {
  const location = useLocation();
  const path = location.pathname;
  const tool = TOOLS_LIST.find((t) => t.path === path);

  return (
    <div className="tool-placeholder">
      <div className="tool-placeholder__icon-wrap">
        <ToolOutlined className="tool-placeholder__icon" />
      </div>
      <h2 className="tool-placeholder__title">
        {tool?.name || '工具页面'}
      </h2>
      <p className="tool-placeholder__desc">
        {tool?.description || '该工具正在开发中，敬请期待...'}
      </p>
      <div className="tool-placeholder__badge">🚧 开发中</div>
      <Button
        icon={<ArrowLeftOutlined />}
        onClick={() => window.history.back()}
        className="tool-placeholder__back-btn"
      >
        返回
      </Button>
    </div>
  );
};

export default ToolPlaceholder;
