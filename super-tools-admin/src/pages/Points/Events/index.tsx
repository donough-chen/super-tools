import React, { useEffect, useState } from 'react';
import {
  Card, Table, Button, Space, Tag, Select, Input, InputNumber,
  DatePicker, message, Modal, Typography,
} from 'antd';
import { ReloadOutlined, RedoOutlined, EyeOutlined } from '@ant-design/icons';
import dayjs, { Dayjs } from 'dayjs';
import AuthButton from '@/components/AuthButton';
import {
  listDomainEvents, retryDomainEvent,
  DomainEvent, DomainEventStatus, DomainEventListQuery,
} from '@/services/points';
import { formatDateTime } from '@/utils/format';

/**
 * 领域事件追溯（Plan §Task 12）
 *
 * 后端路由（router.ts）：
 *   GET  /api/admin/points/events                  (perm points:events:list)
 *   POST /api/admin/points/events/:id/retry        (perm points:events:retry)
 *
 * 按钮权限（database/028 §4 type=3）：
 *   points:btn:events:retry
 *
 * 数据基础：
 *   - 表 domain_events（database/026 §16）
 *   - status: emitted | dispatched | failed
 *   - retry 仅 status=failed 可触发，重置为 emitted + retry_count++
 */
const STATUS_COLOR: Record<DomainEventStatus, string> = {
  emitted: 'blue',
  dispatched: 'green',
  failed: 'red',
};

const Events: React.FC = () => {
  const [data, setData] = useState<{ list: DomainEvent[]; total: number }>({ list: [], total: 0 });
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [filters, setFilters] = useState<DomainEventListQuery>({});
  const [timeRange, setTimeRange] = useState<[Dayjs | null, Dayjs | null] | null>(null);
  const [viewing, setViewing] = useState<DomainEvent | null>(null);

  const fetchList = async () => {
    setLoading(true);
    try {
      const params: DomainEventListQuery = {
        ...filters,
        page,
        pageSize,
        startTime: timeRange?.[0]?.toISOString(),
        endTime: timeRange?.[1]?.toISOString(),
      };
      const res: any = await listDomainEvents(params);
      if (res?.code === 200) {
        setData({ list: res.data?.list || [], total: res.data?.total || 0 });
      }
    } finally {
      setLoading(false);
    }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { fetchList(); }, [page, pageSize, filters, timeRange]);

  const handleRetry = (id: number) => {
    Modal.confirm({
      title: '确认重试该失败事件？',
      content: '将重置 status=emitted，retry_count+1，由订阅系统下一轮调度托底派发。',
      onOk: async () => {
        const res: any = await retryDomainEvent(id);
        if (res?.code === 200) {
          message.success(`已重置事件 #${id}，retry_count=${res.data?.retryCount}`);
          fetchList();
        }
      },
    });
  };

  const columns = [
    { title: 'ID', dataIndex: 'id', width: 80 },
    { title: '事件 Code', dataIndex: 'eventCode', width: 200, ellipsis: true },
    { title: '用户 ID', dataIndex: 'userId', width: 90 },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      render: (v: DomainEventStatus) => <Tag color={STATUS_COLOR[v]}>{v}</Tag>,
    },
    { title: '重试次数', dataIndex: 'retryCount', width: 90 },
    {
      title: '最后错误',
      dataIndex: 'lastError',
      ellipsis: true,
      render: (v: string | null) =>
        v ? <Typography.Text type="danger" ellipsis={{ tooltip: v }} style={{ maxWidth: 280 }}>{v}</Typography.Text> : '-',
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
      width: 180,
      fixed: 'right' as const,
      render: (_: any, r: DomainEvent) => (
        <Space size={4}>
          <Button size="small" icon={<EyeOutlined />} onClick={() => setViewing(r)}>详情</Button>
          <AuthButton permCode="points:btn:events:retry">
            <Button
              size="small"
              type="primary"
              icon={<RedoOutlined />}
              disabled={r.status !== 'failed'}
              onClick={() => handleRetry(r.id)}
            >
              重试
            </Button>
          </AuthButton>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <Card title="领域事件追溯">
        <Space style={{ marginBottom: 16 }} wrap>
          <Input
            placeholder="事件 Code"
            allowClear
            style={{ width: 200 }}
            value={filters.eventCode}
            onChange={(e) => { setPage(1); setFilters({ ...filters, eventCode: e.target.value || undefined }); }}
          />
          <InputNumber
            placeholder="用户 ID"
            min={1}
            style={{ width: 120 }}
            value={filters.userId}
            onChange={(v) => { setPage(1); setFilters({ ...filters, userId: (v as number) || undefined }); }}
          />
          <Select
            placeholder="状态"
            allowClear
            style={{ width: 130 }}
            value={filters.status}
            onChange={(v) => { setPage(1); setFilters({ ...filters, status: v }); }}
            options={[
              { value: 'emitted', label: 'emitted' },
              { value: 'dispatched', label: 'dispatched' },
              { value: 'failed', label: 'failed' },
            ]}
          />
          <DatePicker.RangePicker
            showTime
            value={timeRange as any}
            onChange={(v) => { setPage(1); setTimeRange(v as any); }}
          />
          <Button icon={<ReloadOutlined />} onClick={fetchList}>刷新</Button>
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
            onChange: (p, ps) => { setPage(p); setPageSize(ps); },
          }}
        />
      </Card>

      <Modal
        open={!!viewing}
        title={`事件详情 #${viewing?.id}`}
        onCancel={() => setViewing(null)}
        footer={null}
        width={720}
      >
        {viewing && (
          <div>
            <p><b>事件 Code：</b>{viewing.eventCode}</p>
            <p><b>用户 ID：</b>{viewing.userId}</p>
            <p><b>状态：</b><Tag color={STATUS_COLOR[viewing.status]}>{viewing.status}</Tag></p>
            <p><b>重试次数：</b>{viewing.retryCount}</p>
            <p><b>创建时间：</b>{formatDateTime(viewing.createdAt)}</p>
            {viewing.lastError && (
              <>
                <p><b>最后错误：</b></p>
                <pre style={{ background: '#fff1f0', padding: 8, borderRadius: 4, color: '#a8071a', whiteSpace: 'pre-wrap' }}>
                  {viewing.lastError}
                </pre>
              </>
            )}
            <p><b>Payload：</b></p>
            <pre style={{ background: '#fafafa', padding: 8, borderRadius: 4, maxHeight: 360, overflow: 'auto' }}>
              {viewing.payload ? JSON.stringify(viewing.payload, null, 2) : '(null)'}
            </pre>
          </div>
        )}
      </Modal>
    </div>
  );
};

void dayjs;
export default Events;
