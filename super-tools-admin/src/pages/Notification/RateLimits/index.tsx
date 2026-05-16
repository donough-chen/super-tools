import React, { useEffect, useState } from 'react';
import { Table, Button, Space, Tag, Modal, Form, Input, Select, InputNumber, Switch, message, Popconfirm } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import request from '@/utils/request';

const scopeOptions = [
  { label: '用户全局', value: 'global_user' },
  { label: '渠道', value: 'channel' },
  { label: '类型', value: 'type' },
  { label: '全站', value: 'global' },
];

export default () => {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form] = Form.useForm();

  const fetch = async () => {
    setLoading(true);
    try {
      const res = await request('/api/admin/notification/rate-limits', { params: { pageSize: 100 } });
      if (res?.code === 200) setData(res.data?.list || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetch(); }, []);

  const handleSave = async () => {
    const values = await form.validateFields();
    if (editing) {
      await request(`/api/admin/notification/rate-limits/${editing.id}`, { method: 'PUT', data: values });
      message.success('更新成功');
    } else {
      await request('/api/admin/notification/rate-limits', { method: 'POST', data: values });
      message.success('创建成功');
    }
    setModalOpen(false);
    form.resetFields();
    setEditing(null);
    fetch();
  };

  const handleDelete = async (id: number) => {
    await request(`/api/admin/notification/rate-limits/${id}`, { method: 'DELETE' });
    message.success('删除成功');
    fetch();
  };

  const handleToggle = async (record: any) => {
    await request(`/api/admin/notification/rate-limits/${record.id}`, {
      method: 'PUT', data: { enabled: record.enabled ? 0 : 1 },
    });
    fetch();
  };

  const windowLabel = (w: string, ws: number) => {
    if (ws) return `${ws}s`;
    return w || '-';
  };

  const columns = [
    { title: 'ID', dataIndex: 'id', width: 50 },
    { title: '范围', dataIndex: 'scope', width: 100, render: (v: string) => <Tag>{v}</Tag> },
    { title: '目标', dataIndex: 'targetKey', width: 100, render: (v: string) => v || '-' },
    { title: '窗口', width: 80, render: (_: any, r: any) => windowLabel(r.window, r.windowSeconds) },
    { title: '上限', dataIndex: 'maxCount', width: 70 },
    {
      title: '启用', dataIndex: 'enabled', width: 70,
      render: (_: any, r: any) => <Switch checked={!!r.enabled} onChange={() => handleToggle(r)} size="small" />,
    },
    { title: '描述', dataIndex: 'description', ellipsis: true },
    {
      title: '操作', width: 120,
      render: (_: any, r: any) => (
        <Space size="small">
          <a onClick={() => { setEditing(r); form.setFieldsValue(r); setModalOpen(true); }}>编辑</a>
          <Popconfirm title="确认删除？" onConfirm={() => handleDelete(r.id)}>
            <a style={{ color: '#ff4d4f' }}>删除</a>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
        <h3>频控规则配置</h3>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditing(null); form.resetFields(); setModalOpen(true); }}>
          新增规则
        </Button>
      </div>
      <Table rowKey="id" columns={columns} dataSource={data} loading={loading} pagination={false} size="small" />
      <Modal title={editing ? '编辑规则' : '新增规则'} open={modalOpen} onOk={handleSave} onCancel={() => setModalOpen(false)} destroyOnClose>
        <Form form={form} layout="vertical">
          <Form.Item name="scope" label="范围" rules={[{ required: true }]}><Select options={scopeOptions} /></Form.Item>
          <Form.Item name="targetKey" label="目标Key（渠道名/类型code）"><Input placeholder="如 sms / email" /></Form.Item>
          <Form.Item name="window" label="窗口" initialValue="hour">
            <Select options={[{ label: '小时', value: 'hour' }, { label: '天', value: 'day' }, { label: '周', value: 'week' }]} />
          </Form.Item>
          <Form.Item name="maxCount" label="上限" rules={[{ required: true }]}><InputNumber min={1} style={{ width: '100%' }} /></Form.Item>
          <Form.Item name="description" label="描述"><Input /></Form.Item>
        </Form>
      </Modal>
    </div>
  );
};
