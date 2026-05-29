import React, { useEffect, useState } from 'react';
import {
  Card, Table, Button, Space, Tag, InputNumber, Alert, Modal, Descriptions,
} from 'antd';
import { ReloadOutlined, EyeOutlined } from '@ant-design/icons';
import {
  listRefundLedger, getRefundLedgerFlag,
  RefundLedgerEntry, RefundLedgerFlag,
} from '@/services/points';
import { formatDateTime } from '@/utils/format';

/**
 * 退款账本（Plan §Task 13 / B1 灰度）
 *
 * 后端路由（router.ts）：
 *   GET /api/admin/points/refund-ledger          (perm points:refund-ledger:list)
 *   GET /api/admin/points/refund-ledger/flag     (perm points:refund-ledger:flag)
 *
 * 数据基础：
 *   - points_logs.metadata JSON 列（database/027 §1）
 *   - 命中条件 metadata.scenario='B1_REFUND'
 *   - 灰度开关 system_configs.refund.reverse_fifo（默认 false）
 *
 * payload schema（由后端 service raw query 解出）：
 *   { scenario, originalLogId, refundAmount, recoverHere, overflow, fallbackBatchIds[] }
 */

const POINTS_TYPE_LABEL: Record<number, { color: string; text: string }> = {
  1: { color: 'green', text: '获得' },
  2: { color: 'orange', text: '消费' },
  3: { color: 'gray', text: '过期' },
  4: { color: 'red', text: '退款回收' },
};

const RefundLedger: React.FC = () => {
  const [flag, setFlag] = useState<RefundLedgerFlag | null>(null);
  const [data, setData] = useState<{ list: RefundLedgerEntry[]; total: number }>({ list: [], total: 0 });
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [filters, setFilters] = useState<{ userId?: number; originalLogId?: number }>({});
  const [viewing, setViewing] = useState<RefundLedgerEntry | null>(null);

  const fetchFlag = async () => {
    const res: any = await getRefundLedgerFlag();
    if (res?.code === 200) setFlag(res.data);
  };

  const fetchList = async () => {
    setLoading(true);
    try {
      const res: any = await listRefundLedger({ ...filters, page, pageSize });
      if (res?.code === 200) {
        setData({ list: res.data?.list || [], total: res.data?.total || 0 });
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchFlag(); }, []);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { fetchList(); }, [page, pageSize, filters]);

  const columns = [
    { title: '日志 ID', dataIndex: 'id', width: 90 },
    { title: '用户 ID', dataIndex: 'userId', width: 90 },
    {
      title: '类型',
      dataIndex: 'type',
      width: 100,
      render: (v: number) => {
        const m = POINTS_TYPE_LABEL[v];
        return m ? <Tag color={m.color}>{m.text}</Tag> : <Tag>type={v}</Tag>;
      },
    },
    { title: '来源', dataIndex: 'source', width: 140, ellipsis: true },
    {
      title: '积分',
      dataIndex: 'points',
      width: 90,
      render: (v: number) => (
        <span style={{ color: v >= 0 ? '#3f8600' : '#cf1322' }}>{v >= 0 ? `+${v}` : v}</span>
      ),
    },
    { title: '余额', dataIndex: 'balance', width: 90 },
    {
      title: '原批次',
      width: 90,
      render: (_: any, r: RefundLedgerEntry) => r.metadata?.originalLogId || '-',
    },
    {
      title: '退款额',
      width: 90,
      render: (_: any, r: RefundLedgerEntry) => r.metadata?.refundAmount ?? '-',
    },
    {
      title: '本批回收',
      width: 100,
      render: (_: any, r: RefundLedgerEntry) => r.metadata?.recoverHere ?? '-',
    },
    {
      title: '溢出',
      width: 80,
      render: (_: any, r: RefundLedgerEntry) =>
        (r.metadata?.overflow ?? 0) > 0
          ? <Tag color="red">{r.metadata?.overflow}</Tag>
          : (r.metadata?.overflow ?? '-'),
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
      width: 90,
      fixed: 'right' as const,
      render: (_: any, r: RefundLedgerEntry) => (
        <Button size="small" icon={<EyeOutlined />} onClick={() => setViewing(r)}>详情</Button>
      ),
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <Card title="退款账本（B1 灰度）">
        {/* 灰度开关状态条 */}
        {flag && (
          <Alert
            type={flag.enabled ? 'success' : 'warning'}
            showIcon
            style={{ marginBottom: 16 }}
            message={
              <Space>
                <span>反向 FIFO 退款逻辑：</span>
                <Tag color={flag.enabled ? 'green' : 'default'}>
                  {flag.enabled ? '已启用（新逻辑）' : '未启用（旧逻辑）'}
                </Tag>
                <span style={{ color: '#999' }}>
                  system_configs.refund.reverse_fifo = {flag.raw}
                  {!flag.exists && '（配置项缺失，默认 false）'}
                </span>
              </Space>
            }
          />
        )}

        <Space style={{ marginBottom: 16 }}>
          <InputNumber
            placeholder="用户 ID"
            min={1}
            style={{ width: 120 }}
            value={filters.userId}
            onChange={(v) => { setPage(1); setFilters({ ...filters, userId: (v as number) || undefined }); }}
          />
          <InputNumber
            placeholder="原批次日志 ID"
            min={1}
            style={{ width: 150 }}
            value={filters.originalLogId}
            onChange={(v) => { setPage(1); setFilters({ ...filters, originalLogId: (v as number) || undefined }); }}
          />
          <Button icon={<ReloadOutlined />} onClick={() => { fetchFlag(); fetchList(); }}>刷新</Button>
        </Space>

        <Table
          rowKey="id"
          dataSource={data.list}
          columns={columns}
          loading={loading}
          scroll={{ x: 1300 }}
          pagination={{
            current: page,
            pageSize,
            total: data.total,
            showTotal: (t) => `共 ${t} 条`,
            showSizeChanger: true,
            onChange: (p, ps) => { setPage(p); setPageSize(ps); },
          }}
        />
      </Card>

      <Modal
        open={!!viewing}
        title={`退款账本详情 #${viewing?.id}`}
        onCancel={() => setViewing(null)}
        footer={null}
        width={720}
      >
        {viewing && (
          <Descriptions bordered size="small" column={2}>
            <Descriptions.Item label="用户 ID">{viewing.userId}</Descriptions.Item>
            <Descriptions.Item label="类型">
              {POINTS_TYPE_LABEL[viewing.type]?.text || viewing.type}
            </Descriptions.Item>
            <Descriptions.Item label="来源">{viewing.source}</Descriptions.Item>
            <Descriptions.Item label="积分">{viewing.points}</Descriptions.Item>
            <Descriptions.Item label="余额">{viewing.balance}</Descriptions.Item>
            <Descriptions.Item label="业务类型">{viewing.bizType || '-'}</Descriptions.Item>
            <Descriptions.Item label="业务 ID" span={2}>{viewing.bizId || '-'}</Descriptions.Item>
            <Descriptions.Item label="备注" span={2}>{viewing.remark || '-'}</Descriptions.Item>
            <Descriptions.Item label="原批次 ID">{viewing.metadata?.originalLogId ?? '-'}</Descriptions.Item>
            <Descriptions.Item label="退款总额">{viewing.metadata?.refundAmount ?? '-'}</Descriptions.Item>
            <Descriptions.Item label="本批回收">{viewing.metadata?.recoverHere ?? '-'}</Descriptions.Item>
            <Descriptions.Item label="溢出扣余额">{viewing.metadata?.overflow ?? '-'}</Descriptions.Item>
            <Descriptions.Item label="后续兜底批次" span={2}>
              {viewing.metadata?.fallbackBatchIds?.length
                ? viewing.metadata.fallbackBatchIds.join(', ')
                : '-'}
            </Descriptions.Item>
            <Descriptions.Item label="创建时间" span={2}>{formatDateTime(viewing.createdAt)}</Descriptions.Item>
            <Descriptions.Item label="完整 metadata" span={2}>
              <pre style={{ margin: 0, background: '#fafafa', padding: 8, borderRadius: 4, maxHeight: 240, overflow: 'auto' }}>
                {JSON.stringify(viewing.metadata, null, 2)}
              </pre>
            </Descriptions.Item>
          </Descriptions>
        )}
      </Modal>
    </div>
  );
};

export default RefundLedger;
