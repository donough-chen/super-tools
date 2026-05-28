import React from 'react';
import { Card, Tag, Alert, Empty } from 'antd';

/**
 * 退款账本（B1 灰度·占位页）
 *
 * 数据基础（已落库）：
 *   - points_logs.metadata JSON 列（database/027 §1，存 scenario / originalLogId
 *     / refundAmount / recoverHere / overflow / fallbackBatchIds）
 *   - system_configs.refund.reverse_fifo 灰度开关（默认 false）
 *
 * 后端 API（待补）：
 *   - GET /api/admin/points/refund-ledger          按 metadata.scenario='B1_REFUND' 查询
 *   - GET /api/admin/points/refund-ledger/flag     读当前 reverse_fifo 灰度状态
 *
 * 菜单权限：points:menu:refund-ledger
 *
 * 备注：B1 反向 FIFO 退款账本是 027 灰度上线的特性，前端先建占位 + 灰度状态展示位。
 */
const RefundLedger: React.FC = () => (
  <div style={{ padding: 24 }}>
    <Card title="退款账本（B1 灰度）">
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
        message="功能预告"
        description={
          <>
            <div>本页面用于监控 B1 反向 FIFO 退款账本：</div>
            <ul style={{ marginTop: 8, marginBottom: 8 }}>
              <li>
                展示 <Tag>system_configs.refund.reverse_fifo</Tag> 当前灰度状态
              </li>
              <li>
                查询 <Tag>points_logs.metadata.scenario = "B1_REFUND"</Tag> 的所有退款记录
              </li>
              <li>展示原批次扣回 / 后续批次回收 / 溢出扣余额三段流水关系</li>
            </ul>
            <div>当前后端 API 尚未提供，依赖 027 灰度上线后补充。</div>
          </>
        }
      />
      <Empty description="等待后端 API 接入" />
    </Card>
  </div>
);

export default RefundLedger;
