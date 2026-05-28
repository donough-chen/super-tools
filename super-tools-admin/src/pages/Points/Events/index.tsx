import React from 'react';
import { Card, Empty, Tag, Alert } from 'antd';

/**
 * 领域事件追溯（占位页）
 *
 * 数据基础：
 *   - 表 domain_events 已落库（database/026 §16）
 *   - 字段：event_code / user_id / payload / status(emitted|dispatched|failed)
 *           / retry_count / last_error / created_at / updated_at
 *
 * 后端 API（待补）：
 *   - GET  /api/admin/points/events                  列表查询
 *   - POST /api/admin/points/events/:id/retry        手动重试派发
 *
 * 菜单权限：points:menu:events
 *
 * 备注：本页仅做占位，等后端路由与 controller.admin.pointsOps.events 接入后即可启用。
 *      Plan §Task 12 明确：当前阶段不阻塞前端构建。
 */
const Events: React.FC = () => (
  <div style={{ padding: 24 }}>
    <Card title="领域事件追溯">
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
        message="功能预告"
        description={
          <>
            <div>
              本页面将基于 <Tag>domain_events</Tag> 表（database/026_points_growth_system_optimization.sql §16）展示事件流：
            </div>
            <ul style={{ marginTop: 8, marginBottom: 8 }}>
              <li>按 event_code / user_id / status 多维筛选</li>
              <li>查看 payload JSON 详情</li>
              <li>对 status=failed 事件支持「重试派发」（点击 retry）</li>
            </ul>
            <div>
              当前后端 API 尚未提供（路由 <Tag>GET /api/admin/points/events</Tag> 待补），上线后此页自动启用。
            </div>
          </>
        }
      />
      <Empty description="等待后端 API 接入" />
    </Card>
  </div>
);

export default Events;
