import React from 'react';
import { Card } from 'antd';
import PointsLogsTab from '@/pages/Member/Users/PointsLogsTab';

/**
 * 全局积分流水查询
 *
 * 复用 pages/Member/Users/PointsLogsTab：
 *   - 不传 initialUserId 即为"全量查询模式"，userId 为可选筛选项
 *   - 字段集来自 service.member.getAdminPointsLogs（管理端接口）
 *   - 权限码：member:points:log:view（已存在；本页通过菜单 points:menu:logs 进入，
 *            按钮级无新增）
 *
 * 备注：
 *   - 本页不直接调 services/points.ts，而是延用 services/member.listPointsLogs，
 *     与 Member 模块的「积分流水 Tab」保持完全一致的数据视角
 *   - 后续若 service.points 提供专属 admin/points/logs 接口可再做切换
 */
const PointsLogs: React.FC = () => (
  <div style={{ padding: 24 }}>
    <Card title="积分流水查询">
      <PointsLogsTab />
    </Card>
  </div>
);

export default PointsLogs;
