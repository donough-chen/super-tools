import React from 'react';
import { PageContainer } from '@ant-design/pro-layout';
import { Tabs } from 'antd';
import UserBehavior from './components/UserBehavior';
import ToolUsageTab from './components/ToolUsage';
import OperationEfficiency from './components/OperationEfficiency';

const DashboardAnalytics: React.FC = () => {
  const items = [
    { key: 'user', label: '用户行为分析', children: <UserBehavior /> },
    { key: 'tool', label: '工具使用统计', children: <ToolUsageTab /> },
    { key: 'operation', label: '运营效率指标', children: <OperationEfficiency /> },
  ];

  return (
    <PageContainer title="业务分析" subTitle="深度数据洞察与趋势分析">
      <Tabs items={items} defaultActiveKey="user" size="large" />
    </PageContainer>
  );
};

export default DashboardAnalytics;
