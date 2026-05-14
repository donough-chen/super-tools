import React, { useState, useEffect } from 'react';
import { PageContainer } from '@ant-design/pro-layout';
import { Card, Table, Button, Space, Tag, Switch, Modal, Form, Input, Select, InputNumber, message, Popconfirm } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { getAlertRules, createAlertRule, updateAlertRule, deleteAlertRule, toggleAlertRule } from '@/services/dashboard';

const metricOptions = [
  { value: 'error_rate', label: 'API错误率(%)' },
  { value: 'response_time', label: 'API响应时间(ms)' },
  { value: 'active_user', label: '活跃用户数' },
  { value: 'new_user', label: '新增用户数' },
  { value: 'tool_usage', label: '工具使用量' },
  { value: 'feedback_pending', label: '待处理反馈数' },
  { value: 'member_expire', label: '即将过期会员数' },
  { value: 'session_count', label: '在线会话数' },
];

const conditionOptions = [
  { value: 'gt', label: '大于 (>)' },
  { value: 'lt', label: '小于 (<)' },
  { value: 'gte', label: '大于等于 (>=)' },
  { value: 'lte', label: '小于等于 (<=)' },
  { value: 'change_rate_up', label: '环比上升超过(%)' },
  { value: 'change_rate_down', label: '环比下降超过(%)' },
];

const severityColors: Record<string, string> = { critical: 'red', warning: 'orange', info: 'blue' };

const AlertRules: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [rules, setRules] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingRule, setEditingRule] = useState<any>(null);
  const [form] = Form.useForm();

  useEffect(() => { fetchRules(); }, []);

  const fetchRules = async () => {
    setLoading(true);
    try {
      const res = await getAlertRules({ pageSize: 100 });
      setRules(res?.data?.list || []);
      setTotal(res?.data?.total || 0);
    } finally { setLoading(false); }
  };

  const handleSubmit = async () => {
    const values = await form.validateFields();
    if (editingRule) {
      await updateAlertRule(editingRule.id, values);
      message.success('更新成功');
    } else {
      await createAlertRule(values);
      message.success('创建成功');
    }
    setModalVisible(false);
    form.resetFields();
    setEditingRule(null);
    fetchRules();
  };

  const handleEdit = (record: any) => {
    setEditingRule(record);
    form.setFieldsValue({
      name: record.name,
      description: record.description,
      metricType: record.metric_type,
      conditionType: record.condition_type,
      threshold: record.threshold,
      timeWindow: record.time_window,
      severity: record.severity,
      cooldownMinutes: record.cooldown_minutes,
    });
    setModalVisible(true);
  };

  const handleDelete = async (id: number) => {
    await deleteAlertRule(id);
    message.success('删除成功');
    fetchRules();
  };

  const handleToggle = async (id: number) => {
    await toggleAlertRule(id);
    fetchRules();
  };

  const columns = [
    { title: '名称', dataIndex: 'name', key: 'name' },
    {
      title: '指标', dataIndex: 'metric_type', key: 'metric',
      render: (v: string) => metricOptions.find(o => o.value === v)?.label || v,
    },
    {
      title: '条件', key: 'condition',
      render: (_: any, r: any) => `${conditionOptions.find(o => o.value === r.condition_type)?.label || r.condition_type} ${r.threshold}`,
    },
    {
      title: '严重度', dataIndex: 'severity', key: 'severity',
      render: (v: string) => <Tag color={severityColors[v]}>{v?.toUpperCase()}</Tag>,
    },
    {
      title: '时间窗口', dataIndex: 'time_window', key: 'tw',
      render: (v: number) => `${v}分钟`,
    },
    {
      title: '状态', dataIndex: 'is_enabled', key: 'enabled',
      render: (v: number, r: any) => <Switch checked={!!v} onChange={() => handleToggle(r.id)} size="small" />,
    },
    {
      title: '操作', key: 'actions',
      render: (_: any, record: any) => (
        <Space size="small">
          <Button type="link" size="small" onClick={() => handleEdit(record)}>编辑</Button>
          <Popconfirm title="确定删除？" onConfirm={() => handleDelete(record.id)}>
            <Button type="link" size="small" danger>删除</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <PageContainer title="告警规则管理">
      <Card
        bordered={false}
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditingRule(null); form.resetFields(); setModalVisible(true); }}>
            新建规则
          </Button>
        }
      >
        <Table dataSource={rules} columns={columns} rowKey="id" loading={loading} size="small" pagination={false} />
      </Card>

      <Modal
        title={editingRule ? '编辑规则' : '新建规则'}
        open={modalVisible}
        onOk={handleSubmit}
        onCancel={() => { setModalVisible(false); setEditingRule(null); }}
        width={600}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="规则名称" rules={[{ required: true }]}>
            <Input placeholder="如: API错误率飙升" />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input.TextArea rows={2} />
          </Form.Item>
          <Space style={{ width: '100%' }} size={16}>
            <Form.Item name="metricType" label="监控指标" rules={[{ required: true }]} style={{ width: 200 }}>
              <Select options={metricOptions} placeholder="选择指标" />
            </Form.Item>
            <Form.Item name="conditionType" label="条件" rules={[{ required: true }]} style={{ width: 200 }}>
              <Select options={conditionOptions} placeholder="选择条件" />
            </Form.Item>
            <Form.Item name="threshold" label="阈值" rules={[{ required: true }]} style={{ width: 120 }}>
              <InputNumber style={{ width: '100%' }} />
            </Form.Item>
          </Space>
          <Space style={{ width: '100%' }} size={16}>
            <Form.Item name="timeWindow" label="检测窗口(分钟)" initialValue={60}>
              <InputNumber min={1} style={{ width: 150 }} />
            </Form.Item>
            <Form.Item name="severity" label="严重度" initialValue="warning">
              <Select style={{ width: 120 }}>
                <Select.Option value="info">Info</Select.Option>
                <Select.Option value="warning">Warning</Select.Option>
                <Select.Option value="critical">Critical</Select.Option>
              </Select>
            </Form.Item>
            <Form.Item name="cooldownMinutes" label="冷却时间(分钟)" initialValue={30}>
              <InputNumber min={1} style={{ width: 150 }} />
            </Form.Item>
          </Space>
        </Form>
      </Modal>
    </PageContainer>
  );
};

export default AlertRules;
