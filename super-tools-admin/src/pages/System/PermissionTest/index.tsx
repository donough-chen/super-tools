import React from 'react';
import { Card, Tabs } from 'antd';
import UserOverviewTab from './UserOverviewTab';
import UserCheckTab from './UserCheckTab';
import RoleCheckTab from './RoleCheckTab';
import './index.less';

const PermissionTestPage: React.FC = () => {
  return (
    <Card title="权限测试" className="page-system-permission-test">
      <Tabs
        defaultActiveKey="user-overview"
        items={[
          {
            key: 'user-overview',
            label: '用户全景',
            children: <UserOverviewTab />,
          },
          {
            key: 'user-check',
            label: '用户接口/权限码命中',
            children: <UserCheckTab />,
          },
          {
            key: 'role-check',
            label: '角色矩阵',
            children: <RoleCheckTab />,
          },
        ]}
      />
    </Card>
  );
};

export default PermissionTestPage;
