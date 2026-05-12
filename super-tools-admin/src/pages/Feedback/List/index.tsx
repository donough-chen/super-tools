import React, { useEffect, useMemo, useState } from 'react';
import {
  Card, Table, Button, Input, InputNumber, Space, Popconfirm, message,
  Form, Select, DatePicker, Tag, Tooltip,
} from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import AuthButton from '@/components/AuthButton';
import {
  listFeedbacks, deleteFeedback, updateFeedback,
  Feedback, FeedbackListQuery, FeedbackStatus,
} from '@/services/feedback';
import { STATUS_LABELS, getAllowedTransitions } from '@/utils/feedbackStatus';
import { formatDateTime } from '@/utils/format';
import DetailDrawer from './DetailDrawer';
import './index.less';

const { RangePicker } = DatePicker;

const TYPE_OPTIONS = [
  { label: 'Bug', value: 'bug' },
  { label: '建议', value: 'suggestion' },
  { label: '表扬', value: 'praise' },
  { label: '其它', value: 'other' },
];

const TYPE_COLOR: Record<string, string> = {
  bug: 'red',
  suggestion: 'blue',
  praise: 'gold',
  other: 'default',
};

const FeedbackPage: React.FC = () => {
  const [data, setData] = useState<{ rows: Feedback[]; total: number }>({ rows: [], total: 0 });
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [filters, setFilters] = useState<FeedbackListQuery>({});
  const [target, setTarget] = useState<Feedback | null>(null);
  const [drawerVisible, setDrawerVisible] = useState(false);

  const fetch = async () => {
    setLoading(true);
    try {
      const res: any = await listFeedbacks({ page, pageSize, ...filters });
      // 后端 service.feedback.list 返回 { total, page, pageSize, rows }
      if (res?.code === 200 && res.data) {
        setData({ rows: res.data.rows || [], total: res.data.total || 0 });
      }
    } finally { setLoading(false); }
  };

  useEffect(() => {
    fetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, pageSize, filters]);

  const handleStatus = async (row: Feedback, newStatus: FeedbackStatus) => {
    const res: any = await updateFeedback(row.id, { status: newStatus });
    if (res?.code === 200) {
      message.success('已更新');
      fetch();
    } else {
      message.error(res?.message || '更新失败');
    }
  };

  const handleDelete = async (id: number) => {
    const res: any = await deleteFeedback(id);
    if (res?.code === 200) {
      message.success('删除成功');
      fetch();
    } else {
      message.error(res?.message || '删除失败');
    }
  };

  const columns = useMemo(() => [
    { title: 'ID', dataIndex: 'id', width: 70 },
    {
      title: '类型', dataIndex: 'type', width: 90,
      render: (v: string) => <Tag color={TYPE_COLOR[v] || 'default'}>{v}</Tag>,
    },
    { title: '内容', dataIndex: 'content', ellipsis: true },
    {
      title: '用户', dataIndex: 'user', width: 140,
      render: (u: any, row: Feedback) =>
        u
          ? `${u.username}${u.nickname ? `(${u.nickname})` : ''}`
          : (row.userId ? `#${row.userId}` : '匿名'),
    },
    { title: '联系方式', dataIndex: 'contact', width: 130, render: (v: string) => v || '-' },
    { title: '平台', dataIndex: 'platform', width: 90, render: (v: string) => v || '-' },
    {
      title: '状态', dataIndex: 'status', width: 130,
      render: (v: number, row: Feedback) => {
        const allowed = getAllowedTransitions(v);
        return (
          <AuthButton permCode="feedback:update">
            <Select
              size="small" value={v} style={{ width: 110 }}
              options={[
                { value: v, label: `${STATUS_LABELS[v]}（当前）`, disabled: true },
                ...allowed.map((x) => ({ value: x, label: STATUS_LABELS[x] })),
              ]}
              onChange={(nv) => handleStatus(row, nv as FeedbackStatus)}
            />
          </AuthButton>
        );
      },
    },
    { title: '提交时间', dataIndex: 'createdAt', width: 160, render: (v: string) => formatDateTime(v) },
    {
      title: '操作', width: 180, fixed: 'right' as const,
      render: (_: any, row: Feedback) => (
        <Space size="small">
          <AuthButton permCode="feedback:detail">
            <a onClick={() => { setTarget(row); setDrawerVisible(true); }}>详情</a>
          </AuthButton>
          <AuthButton permCode="feedback:reply">
            {row.status >= 2 ? (
              <Tooltip title="已回复/已关闭，需先重新打开">
                <a className="action-disabled">回复</a>
              </Tooltip>
            ) : (
              <a onClick={() => { setTarget(row); setDrawerVisible(true); }}>回复</a>
            )}
          </AuthButton>
          <AuthButton permCode="feedback:delete">
            <Popconfirm title="确定删除？" onConfirm={() => handleDelete(row.id)}>
              <a style={{ color: '#ff4d4f' }}>删除</a>
            </Popconfirm>
          </AuthButton>
        </Space>
      ),
    },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ], []);

  return (
    <Card title="反馈管理" className="page-feedback">
      <Form
        layout="inline" style={{ marginBottom: 16 }}
        onFinish={(v) => {
          setPage(1);
          setFilters({
            keyword: v.keyword || undefined,
            type: v.type,
            status: v.status,
            platform: v.platform || undefined,
            userId: v.userId,
            startTime: v.range?.[0]?.toISOString(),
            endTime: v.range?.[1]?.toISOString(),
          });
        }}
        onReset={() => { setPage(1); setFilters({}); }}
      >
        <Form.Item name="keyword">
          <Input placeholder="内容关键词" allowClear style={{ width: 180 }} />
        </Form.Item>
        <Form.Item name="type">
          <Select placeholder="类型" allowClear style={{ width: 110 }} options={TYPE_OPTIONS} />
        </Form.Item>
        <Form.Item name="status">
          <Select placeholder="状态" allowClear style={{ width: 110 }}
            options={[0, 1, 2, 3].map((v) => ({ value: v, label: STATUS_LABELS[v] }))}
          />
        </Form.Item>
        <Form.Item name="platform">
          <Input placeholder="平台" allowClear style={{ width: 110 }} />
        </Form.Item>
        <Form.Item name="userId">
          <InputNumber placeholder="用户 ID" min={1} style={{ width: 110 }} />
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
        dataSource={data.rows}
        loading={loading}
        pagination={{
          current: page, pageSize, total: data.total,
          showSizeChanger: true,
          showTotal: (t) => `共 ${t} 条`,
          onChange: (p, ps) => { setPage(p); setPageSize(ps); },
        }}
        scroll={{ x: 1500 }}
      />

      <DetailDrawer
        visible={drawerVisible}
        target={target}
        onClose={() => setDrawerVisible(false)}
        onSuccess={fetch}
      />
    </Card>
  );
};

export default FeedbackPage;
