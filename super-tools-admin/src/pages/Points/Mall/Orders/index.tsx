import React, { useEffect, useState } from 'react';
import { Table, Button, Space, Tag, Card, Select, InputNumber, message } from 'antd';
import { ReloadOutlined, RollbackOutlined } from '@ant-design/icons';
import AuthButton from '@/components/AuthButton';
import { listMallOrders, refundMallOrder, PointsMallOrder } from '@/services/points';
import { formatDateTime } from '@/utils/format';
import RefundModal from './RefundModal';

/**
 * 积分商城 · 订单管理
 *
 * 后端路由（router.ts §积分体系（管理端）商城商品 + 订单管理）：
 *   GET  /api/admin/points/mall/orders                 (perm points:mall:orders)
 *   POST /api/admin/points/mall/orders/:id/refund      (perm points:mall:refund)
 *
 * 按钮权限（database/028 §4 type=3）：
 *   points:btn:mall:order:refund
 */
const FULFILL_COLOR_MAP: Record<string, string> = {
  pending: 'orange',
  success: 'green',
  failed: 'red',
};

const Orders: React.FC = () => {
  const [data, setData] = useState<{ list: PointsMallOrder[]; total: number }>({ list: [], total: 0 });
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [filters, setFilters] = useState<{ fulfillStatus?: string; refundStatus?: string; userId?: number }>({});
  const [refundOrderId, setRefundOrderId] = useState<number | undefined>();
  const [refundOpen, setRefundOpen] = useState(false);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const res: any = await listMallOrders({ ...filters, page, pageSize });
      if (res?.code === 200) {
        setData({ list: res.data?.list || [], total: res.data?.total || 0 });
      }
    } finally {
      setLoading(false);
    }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    fetchOrders();
  }, [page, pageSize, filters]);

  const handleRefund = async (reason: string) => {
    if (!refundOrderId) return;
    const res: any = await refundMallOrder(refundOrderId, reason);
    if (res?.code === 200) {
      message.success('退款成功');
      setRefundOpen(false);
      fetchOrders();
    }
  };

  const columns = [
    { title: '订单 ID', dataIndex: 'id', width: 90 },
    { title: '用户 ID', dataIndex: 'userId', width: 90 },
    { title: '商品 ID', dataIndex: 'itemId', width: 90 },
    { title: '消耗积分', dataIndex: 'costPoints', width: 100 },
    {
      title: '发放状态',
      dataIndex: 'fulfillStatus',
      width: 100,
      render: (v: string) => <Tag color={FULFILL_COLOR_MAP[v] || ''}>{v}</Tag>,
    },
    {
      title: '退款状态',
      dataIndex: 'refundStatus',
      width: 100,
      render: (v: string) =>
        v === 'refunded' ? <Tag color="red">已退款</Tag> : <Tag>{v || '-'}</Tag>,
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      width: 160,
      render: (v: string) => formatDateTime(v),
    },
    {
      title: '操作',
      key: 'op',
      width: 120,
      fixed: 'right' as const,
      render: (_: any, r: PointsMallOrder) => (
        <AuthButton permCode="points:btn:mall:order:refund">
          <Button
            size="small"
            danger
            icon={<RollbackOutlined />}
            disabled={r.refundStatus === 'refunded'}
            onClick={() => {
              setRefundOrderId(r.id);
              setRefundOpen(true);
            }}
          >
            退款
          </Button>
        </AuthButton>
      ),
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <Card>
        <Space style={{ marginBottom: 16 }}>
          <InputNumber
            placeholder="用户 ID"
            min={1}
            style={{ width: 120 }}
            onChange={(v) => {
              setPage(1);
              setFilters({ ...filters, userId: (v as number) || undefined });
            }}
          />
          <Select
            placeholder="发放状态"
            allowClear
            style={{ width: 120 }}
            value={filters.fulfillStatus}
            onChange={(v) => {
              setPage(1);
              setFilters({ ...filters, fulfillStatus: v });
            }}
            options={[
              { value: 'pending', label: 'pending' },
              { value: 'success', label: 'success' },
              { value: 'failed', label: 'failed' },
            ]}
          />
          <Select
            placeholder="退款状态"
            allowClear
            style={{ width: 120 }}
            value={filters.refundStatus}
            onChange={(v) => {
              setPage(1);
              setFilters({ ...filters, refundStatus: v });
            }}
            options={[
              { value: 'none', label: '未退款' },
              { value: 'refunded', label: '已退款' },
            ]}
          />
          <Button icon={<ReloadOutlined />} onClick={fetchOrders}>
            刷新
          </Button>
        </Space>
        <Table
          rowKey="id"
          dataSource={data.list}
          columns={columns}
          loading={loading}
          scroll={{ x: 1100 }}
          pagination={{
            current: page,
            pageSize,
            total: data.total,
            showTotal: (t) => `共 ${t} 条`,
            showSizeChanger: true,
            onChange: (p, ps) => {
              setPage(p);
              setPageSize(ps);
            },
          }}
        />
        <RefundModal
          open={refundOpen}
          orderId={refundOrderId}
          onCancel={() => setRefundOpen(false)}
          onOk={handleRefund}
        />
      </Card>
    </div>
  );
};

export default Orders;
