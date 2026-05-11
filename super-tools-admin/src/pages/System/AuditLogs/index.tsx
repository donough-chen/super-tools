import React, { useEffect, useMemo, useState } from 'react';
import {
  Card, Table, Form, Input, InputNumber, Select, Button, Space, Tag, DatePicker, message,
} from 'antd';
import { ReloadOutlined, DownloadOutlined } from '@ant-design/icons';
import AuthButton from '@/components/AuthButton';
import {
  listAuditLogs, getAuditLog, exportAuditLogs,
  AuditLogListQuery, AuditLogRow, AuditLogDetail,
} from '@/services/audit-log';
import AuditDetailDrawer from './AuditDetailDrawer';
import './index.less';

const MODULE_OPTIONS = [
  { label: '角色', value: 'role' },
  { label: '权限', value: 'permission' },
  { label: '工具', value: 'tool' },
  { label: '分类', value: 'category' },
  { label: '用户', value: 'user' },
  { label: '反馈', value: 'feedback' },
  { label: '会员', value: 'member' },
];

const ACTION_OPTIONS = [
  { label: '创建', value: 'create' },
  { label: '修改', value: 'update' },
  { label: '删除', value: 'delete' },
  { label: '批量更新', value: 'batch_update' },
  { label: '分配权限', value: 'assign_permissions' },
  { label: '回复', value: 'reply' },
  { label: '导出', value: 'export' },
  { label: '调整积分', value: 'adjust_points' },
];

const ACTION_COLOR: Record<string, string> = {
  create: 'green', update: 'blue', delete: 'red',
  batch_update: 'cyan', assign_permissions: 'purple',
  reply: 'gold', export: 'magenta',
};

const AuditLogsPage: React.FC = () => {
  const [data, setData] = useState<{ rows: AuditLogRow[]; total: number }>({ rows: [], total: 0 });
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [filters, setFilters] = useState<AuditLogListQuery>({});
  const [selectedDetail, setSelectedDetail] = useState<AuditLogDetail | null>(null);
  const [detailVisible, setDetailVisible] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [exporting, setExporting] = useState(false);

  const fetch = async () => {
    setLoading(true);
    try {
      const res: any = await listAuditLogs({ page, pageSize, ...filters });
      if (res?.code === 200 && res.data) {
        setData({ rows: res.data.rows || [], total: res.data.total || 0 });
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, pageSize, filters]);

  const handleViewDetail = async (row: AuditLogRow) => {
    setDetailVisible(true);
    setDetailLoading(true);
    setSelectedDetail(null);
    try {
      const res: any = await getAuditLog(row.id);
      if (res?.code === 200) {
        setSelectedDetail(res.data);
      }
    } catch (e: any) {
      message.error(e?.message || '加载详情失败');
    } finally {
      setDetailLoading(false);
    }
  };

  /**
   * 导出 CSV
   * - blob 错误处理：当后端返回 JSON 错误时，blob 含 JSON（需解析为 text 读取错误信息）
   * - 检测 X-Audit-Truncated header
   */
  const handleExport = async () => {
    setExporting(true);
    try {
      const res: any = await exportAuditLogs(filters as any);
      const ct = res?.response?.headers?.get?.('content-type');
      if (ct && ct.startsWith('application/json')) {
        // 后端返回 JSON 错误
        const errText = await res.data.text();
        try {
          const err = JSON.parse(errText);
          message.error(err.message || '导出失败');
        } catch {
          message.error('导出失败');
        }
        return;
      }
      // 正常 CSV blob
      const blob = new Blob([res.data], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `audit-logs-${Date.now()}.csv`;
      a.click();
      URL.revokeObjectURL(url);

      const truncated = res?.response?.headers?.get?.('x-audit-truncated');
      if (truncated === 'true') {
        message.warning('结果超过 10000 行已截断，请缩小时间范围再次导出');
      } else {
        message.success('导出成功');
      }
    } catch (e: any) {
      message.error(e?.message || '导出失败');
    } finally {
      setExporting(false);
    }
  };

  const columns = useMemo(() => [
    { title: '时间', dataIndex: 'createdAt', width: 180 },
    {
      title: '用户', dataIndex: 'username', width: 140,
      render: (v: string, row: AuditLogRow) => `${v} (${row.userId})`,
    },
    {
      title: '模块', dataIndex: 'module', width: 100,
      render: (v: string) => <Tag>{v}</Tag>,
    },
    {
      title: '动作', dataIndex: 'action', width: 130,
      render: (v: string) => <Tag color={ACTION_COLOR[v] || 'default'}>{v}</Tag>,
    },
    { title: '描述', dataIndex: 'description', ellipsis: true },
    {
      title: '业务', width: 130,
      render: (_: any, row: AuditLogRow) => `${row.bizType} #${row.bizId}`,
    },
    {
      title: '耗时', dataIndex: 'costTime', width: 90,
      render: (v: number) => `${v} ms`,
    },
    {
      title: '状态', dataIndex: 'status', width: 80,
      render: (v: number) => v === 1
        ? <Tag color="green">成功</Tag>
        : <Tag color="red">失败</Tag>,
    },
    {
      title: '操作', width: 80, fixed: 'right' as const,
      render: (_: any, row: AuditLogRow) => (
        <a onClick={() => handleViewDetail(row)}>查看</a>
      ),
    },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ], []);

  return (
    <Card title="审计日志" className="page-system-audit-logs">
      <Form
        layout="inline"
        style={{ marginBottom: 16, rowGap: 8, flexWrap: 'wrap' }}
        onFinish={(v) => {
          setPage(1);
          setFilters({
            startTime: v.dateRange?.[0]?.toISOString(),
            endTime: v.dateRange?.[1]?.toISOString(),
            userId: v.userId || undefined,
            module: v.module || undefined,
            action: v.action || undefined,
            status: v.status,
            keyword: v.keyword || undefined,
          });
        }}
      >
        <Form.Item name="dateRange" label="时间">
          <DatePicker.RangePicker showTime />
        </Form.Item>
        <Form.Item name="userId">
          <InputNumber placeholder="用户 ID" style={{ width: 110 }} />
        </Form.Item>
        <Form.Item name="module">
          <Select placeholder="模块" allowClear style={{ width: 130 }} options={MODULE_OPTIONS} />
        </Form.Item>
        <Form.Item name="action">
          <Select placeholder="动作" allowClear style={{ width: 160 }} options={ACTION_OPTIONS} />
        </Form.Item>
        <Form.Item name="status">
          <Select placeholder="状态" allowClear style={{ width: 100 }}
            options={[{ label: '成功', value: 1 }, { label: '失败', value: 0 }]} />
        </Form.Item>
        <Form.Item name="keyword">
          <Input placeholder="描述关键字" allowClear style={{ width: 160 }} />
        </Form.Item>
        <Form.Item>
          <Button type="primary" htmlType="submit">查询</Button>
        </Form.Item>
      </Form>

      <Space style={{ marginBottom: 16 }}>
        <Button onClick={fetch} icon={<ReloadOutlined />}>刷新</Button>
        <AuthButton permCode="system:audit-log:export">
          <Button onClick={handleExport} icon={<DownloadOutlined />} loading={exporting}>
            导出 CSV
          </Button>
        </AuthButton>
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
        scroll={{ x: 1300 }}
      />

      <AuditDetailDrawer
        visible={detailVisible}
        detail={selectedDetail}
        loading={detailLoading}
        onClose={() => setDetailVisible(false)}
      />
    </Card>
  );
};

export default AuditLogsPage;
