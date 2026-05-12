import React, { useState } from 'react';
import { Card, Tabs } from 'antd';
import LevelsTab from './LevelsTab';
import PlansTab from './PlansTab';
import './index.less';

const ConfigPage: React.FC = () => {
  const [tab, setTab] = useState<'levels' | 'plans'>('levels');

  return (
    <Card title="会员配置" className="page-member-config">
      <Tabs
        activeKey={tab}
        onChange={(k) => setTab(k as any)}
        items={[
          { key: 'levels', label: '会员等级', children: <LevelsTab /> },
          { key: 'plans', label: '付费套餐', children: <PlansTab /> },
        ]}
      />
    </Card>
  );
};

export default ConfigPage;
