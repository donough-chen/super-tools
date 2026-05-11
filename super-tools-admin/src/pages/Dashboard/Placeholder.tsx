import React from 'react';
import { Card, Typography, Empty } from 'antd';

/**
 * Dashboard 占位页
 * 由 Spec-C 实现完整数据看板（统计指标、图表等）
 */
const DashboardPlaceholder: React.FC = () => (
  <Card>
    <Typography.Title level={3}>仪表盘</Typography.Title>
    <Empty description="即将到来 — 由 Spec-C 实现完整数据看板" />
  </Card>
);

export default DashboardPlaceholder;
