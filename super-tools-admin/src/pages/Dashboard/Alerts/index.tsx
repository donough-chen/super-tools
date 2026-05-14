import React, { useState, useEffect } from 'react';
import { PageContainer } from '@ant-design/pro-layout';
import { Card, Table, Tag, Button, Space, Row, Col, Statistic, Select, Modal, Input, message, Popconfirm } from 'antd';
import { ExclamationCircleOutlined, CheckCircleOutlined, ClockCircleOutlined } from '@ant-design/icons';
import { Line } from '@ant-design/charts';
import { getAlertLogs, getAlertSummary, acknowledgeAlertLog, resolveAlertLog } from '@/services/dashboard';
import { history } from 'umi';

const severityColors: Record<string, string> = { critical: 'red', warning: 'orange', info: 'blue' };
const statusConfig: Record<string, { color: string; label: string }> = {
  firing: { color: 'red', label: '告警中' },
  acknowledged: { color: 'orange', label: '已确认' },
  resolved: { color: 'green', label: '已解决' },
};

const DashboardAlerts: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<any>({});
  const [summary, setSummary] = useState<any>(null);
  const [resolveModalVisible, setResolveModalVisible] = useState(false);
  const [resolveId, setResolveId] = useState<number | null>(null);
  const [resolveNote, setResolveNote] = useState('');

  useEffect(() => { fetchSummary(); }, []);
  useEffect(() => { fetchLogs(); }, [page, filters]);

  const fetchSummary = async () => {
    const res = await getAlertSummary();
    if (res?.data) setSummary(res.data);
  };

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const res = await getAlertLogs({ page, pageSize: 15, ...filters });
      setLogs(res?.data?.list || []);
      setTotal(res?.data?.total || 0);
    } finally { setLoading(false); }
  };

  const handleAcknowledge = async (id: number) => {
    await acknowledgeAlertLog(id);
    message.success('已确认');
    fetchLogs();
    fetchSummary();
  };

  const handleResolve = async () => {
    if (!resolveId) return;
    await resolveAlertLog(resolveId, resolveNote);
    message.success('已解决');
    setResolveModalVisible(false);
    setResolveNote('');
    fetchLogs();
    fetchSummary();
  };

  const columns = [
    {
      title: '时间', dataIndex: 'created_at', key: 'time', width: 170,
      render: (v: string) => v ? new Date(v).toLocaleString('zh-CN') : '-',
    },
    { title: '规则', dataIndex: 'rule_name', key: 'rule', ellipsis: true },
    {
      title: '严重度', dataIndex: 'severity', key: 'severity', width: 90,
      render: (v: string) => <Tag color={severityColors[v]}>{v?.toUpperCase()}</Tag>,
    },
    { title: '指标值', dataIndex: 'metric_value', key: 'value', width: 90 },
    { title: '阈值', dataIndex: 'threshold_value', key: 'threshold', width: 80 },
    { title: '描述', dataIndex: 'condition_desc', key: 'desc', ellipsis: true },
    {
      title: '状态', dataIndex: 'status', key: 'status', width: 90,
      render: (v: string) => {
        const cfg = statusConfig[v] || { color: 'default', label: v };
        return <Tag color={cfg.color}>{cfg.label}</Tag>;
      },
    },
    {
      title: '操作', key: 'actions', width: 160,
      render: (_: any, record: any) => (
        <Space size="small">
          {record.status === 'firing' && (
            <Popconfirm title="确认此告警？" onConfirm={() => handleAcknowledge(record.id)}>
              <Button type="link" size="small">确认</Button>
            </Popconfirm>
          )}
          {record.status !== 'resolved' && (
            <Button type="link" size="small" onClick={() => { setResolveId(record.id); setResolveModalVisible(true); }}>
              解决
            </Button>
          )}
        </Space>
      ),
    },
  ];

  return (
    <PageContainer
      title="智能预警"
      extra={<Button type="primary" onClick={() => history.push('/dashboard/alerts/rules')}>管理规则</Button>}
    >
      <Space direction="vertical" size={16} style={{ width: '100%' }}>
        {/* 概览卡片 */}
        <Row gutter={16}>
          <Col span={6}>
            <Card bordered={false} size="small">
              <Statistic
                title="严重告警" value={summary?.firing?.critical || 0}
                prefix={<ExclamationCircleOutlined />}
                valueStyle={{ color: '#f5222d' }}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card bordered={false} size="small">
              <Statistic
                title="警告" value={summary?.firing?.warning || 0}
                prefix={<ClockCircleOutlined />}
                valueStyle={{ color: '#fa8c16' }}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card bordered={false} size="small">
              <Statistic title="信息" value={summary?.firing?.info || 0} prefix={<CheckCircleOutlined />} />
            </Card>
          </Col>
          <Col span={6}>
            <Card bordered={false} size="small">
              <Statistic title="今日告警总数" value={summary?.todayTotal || 0} />
            </Card>
          </Col>
        </Row>

        {/* 趋势 */}
        {summary?.trend?.length > 0 && (
          <Card title="近7天告警趋势" bordered={false} size="small">
            <Line data={summary.trend} xField="date" yField="count" height={180} point={{ size: 3 }} />
          </Card>
        )}

        {/* 告警列表 */}
        <Card
          title="告警记录"
          bordered={false}
          extra={
            <Space>
              <Select placeholder="严重度" allowClear style={{ width: 100 }} onChange={v => setFilters((f: any) => ({ ...f, severity: v }))}>
                <Select.Option value="critical">Critical</Select.Option>
                <Select.Option value="warning">Warning</Select.Option>
                <Select.Option value="info">Info</Select.Option>
              </Select>
              <Select placeholder="状态" allowClear style={{ width: 100 }} onChange={v => setFilters((f: any) => ({ ...f, status: v }))}>
                <Select.Option value="firing">告警中</Select.Option>
                <Select.Option value="acknowledged">已确认</Select.Option>
                <Select.Option value="resolved">已解决</Select.Option>
              </Select>
            </Space>
          }
        >
          <Table
            dataSource={logs}
            columns={columns}
            rowKey="id"
            loading={loading}
            size="small"
            pagination={{ current: page, total, pageSize: 15, onChange: setPage }}
          />
        </Card>
      </Space>

      <Modal
        title="解决告警" open={resolveModalVisible}
        onOk={handleResolve} onCancel={() => setResolveModalVisible(false)}
      >
        <Input.TextArea
          placeholder="解决备注（可选）" rows={3}
          value={resolveNote} onChange={e => setResolveNote(e.target.value)}
        />
      </Modal>
    </PageContainer>
  );
};

export default DashboardAlerts;
