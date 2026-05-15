import React, { useEffect, useMemo, useState } from 'react';
import {
  Table, InputNumber, Select, Input, DatePicker, Form, Button, Space, Tag,
} from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import { listPointsLogs, PointsLog, PointsLogsQuery } from '@/services/member';
import { formatDateTime } from '@/utils/format';
import { POINTS_TYPE_LABELS, POINTS_TYPE_COLORS } from '@/utils/memberFormat';

const { RangePicker } = DatePicker;

interface Props {
  initialUserId?: number;
}

const PointsLogsTab: React.FC<Props> = ({ initialUserId }) => {
  const [data, setData] = useState<{ list: PointsLog[]; total: number }>({ list: [], total: 0 });
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [filters, setFilters] = useState<PointsLogsQuery>(
    initialUserId ? { userId: initialUserId } : {}
  );
  const [form] = Form.useForm();

  // initialUserId 变化（跨 Tab 跳转）时同步预填表单
  useEffect(() => {
    if (initialUserId != null) {
      form.setFieldsValue({ userId: initialUserId });
      setFilters({ userId: initialUserId });
      setPage(1);
    }
  }, [initialUserId, form]);

  const fetch = async () => {
    setLoading(true);
    try {
      const res: any = await listPointsLogs({ page, pageSize, ...filters });
      if (res?.code === 200 && res.data) {
        setData({ list: res.data.list || [], total: res.data.total || 0 });
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, pageSize, filters]);

  const columns = useMemo(() => [
    { title: 'ID', dataIndex: 'id', width: 80 },
    {
      title: '时间', dataIndex: 'created_at', width: 160,
      render: (v: string) => formatDateTime(v),
    },
    {
      title: '用户', dataIndex: 'userId', width: 100,
      render: (uid: number) => `#${uid}`,
    },
    {
      title: '类型', dataIndex: 'type', width: 80,
      render: (v: number) => (
        <Tag color={POINTS_TYPE_COLORS[v]}>{POINTS_TYPE_LABELS[v] || v}</Tag>
      ),
    },
    {
      title: '来源', dataIndex: 'source', width: 110,
      render: (v: string) => v ? <Tag>{v}</Tag> : '-',
    },
    {
      title: '积分变动', dataIndex: 'points', width: 100,
      render: (v: number) => (
        <span style={{ color: v >= 0 ? '#52c41a' : '#ff4d4f', fontWeight: 500 }}>
          {v >= 0 ? '+' : ''}{v}
        </span>
      ),
    },
    { title: '余额', dataIndex: 'balance', width: 100 },
    {
      title: '成长变动', dataIndex: 'growthDelta', width: 100,
      render: (v: number) => v || '-',
    },
    {
      title: '备注', dataIndex: 'remark', ellipsis: true,
      render: (v: string) => v || '-',
    },
  ], []);

  return (
    <>
      <Form
        form={form}
        layout="inline"
        style={{ marginBottom: 16 }}
        initialValues={{ userId: initialUserId }}
        onFinish={(v) => {
          setPage(1);
          setFilters({
            userId: v.userId,
            type: v.type,
            source: v.source || undefined,
            startDate: v.range?.[0]?.toISOString(),
            endDate: v.range?.[1]?.toISOString(),
          });
        }}
        onReset={() => { setPage(1); setFilters({}); }}
      >
        <Form.Item name="userId">
          <InputNumber placeholder="用户 ID" min={1} style={{ width: 120 }} />
        </Form.Item>
        <Form.Item name="type">
          <Select
            placeholder="类型" allowClear style={{ width: 100 }}
            options={[
              { value: 1, label: '获得' },
              { value: 2, label: '消耗' },
              { value: 3, label: '过期' },
              { value: 4, label: '管理员调整' },
            ]}
          />
        </Form.Item>
        <Form.Item name="source">
          <Input placeholder="来源" allowClear style={{ width: 110 }} />
        </Form.Item>
        <Form.Item name="range">
          <RangePicker showTime />
        </Form.Item>
        <Form.Item>
          <Space>
            <Button type="primary" htmlType="submit">查询</Button>
            <Button htmlType="reset">重置</Button>
          </Space>
        </Form.Item>
      </Form>

      <Space style={{ marginBottom: 16 }}>
        <Button icon={<ReloadOutlined />} onClick={fetch}>刷新</Button>
      </Space>

      <Table
        rowKey="id"
        columns={columns}
        dataSource={data.list}
        loading={loading}
        pagination={{
          current: page, pageSize, total: data.total,
          showSizeChanger: true,
          showTotal: (t) => `共 ${t} 条`,
          onChange: (p, ps) => { setPage(p); setPageSize(ps); },
        }}
        scroll={{ x: 1100 }}
      />
    </>
  );
};

export default PointsLogsTab;
