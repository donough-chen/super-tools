import React from 'react';
import { Tabs, Card } from 'antd';
import ExpireStatsTab from './ExpireStatsTab';
import ReconcileTab from './ReconcileTab';
import TriggerTab from './TriggerTab';
import CacheTab from './CacheTab';

/**
 * 运维中心
 *
 * 4 个 Tab 整合到一个页面，分别对应：
 *   - 过期统计   (perm: points:expire:stats)
 *   - 对账查询   (perm: points:reconcile:view)
 *   - 定时任务触发 (perm: points:ops:trigger)
 *   - 缓存清理   (perm: points:ops:trigger，按钮 points:btn:ops:clear-cache)
 *
 * 菜单权限：points:menu:ops
 */
const Ops: React.FC = () => (
  <div style={{ padding: 24 }}>
    <Card>
      <Tabs
        defaultActiveKey="expire"
        items={[
          { key: 'expire', label: '过期统计', children: <ExpireStatsTab /> },
          { key: 'reconcile', label: '对账查询', children: <ReconcileTab /> },
          { key: 'trigger', label: '定时任务触发', children: <TriggerTab /> },
          { key: 'cache', label: '缓存清理', children: <CacheTab /> },
        ]}
      />
    </Card>
  </div>
);

export default Ops;
