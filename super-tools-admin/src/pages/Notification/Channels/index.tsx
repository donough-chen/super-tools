import React, { useEffect, useState } from 'react';
import { Table, Button, Tag, Drawer, Form, Input, InputNumber, Switch, message } from 'antd';
import request from '@/utils/request';

export default () => {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [testing, setTesting] = useState(false);
  const [form] = Form.useForm();

  const fetch = async () => {
    setLoading(true);
    try {
      const res = await request('/api/admin/notification/channels', { params: { pageSize: 100 } });
      if (res?.code === 200) setData(res.data?.list || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetch(); }, []);

  const handleSave = async () => {
    const values = await form.validateFields();
    if (!editing) return;
    // 把表单字段合成 config JSON
    const config = {
      host: values.host,
      port: values.port,
      secure: values.secure,
      pool: true,
      auth_user: values.auth_user,
      auth_pass: values.auth_pass,
    };
    await request(`/api/admin/notification/channels/${editing.id}`, {
      method: 'PUT',
      data: { config, enabled: values.enabled ? 1 : 0, description: values.description },
    });
    message.success('保存成功');
    setDrawerOpen(false);
    fetch();
  };

  const handleTestSmtp = async () => {
    setTesting(true);
    try {
      const res = await request('/api/admin/notification/channels/test-smtp', { method: 'POST' });
      if (res?.data?.ok) {
        message.success('SMTP 连接成功');
      } else {
        message.error(res?.data?.message || 'SMTP 连接失败');
      }
    } catch {
      message.error('测试请求失败');
    } finally {
      setTesting(false);
    }
  };

  const openEdit = (record: any) => {
    setEditing(record);
    const cfg = record.config || {};
    form.setFieldsValue({
      host: cfg.host,
      port: cfg.port,
      secure: cfg.secure,
      auth_user: cfg.auth_user,
      auth_pass: cfg.auth_pass,
      enabled: !!record.enabled,
      description: record.description,
    });
    setDrawerOpen(true);
  };

  const columns = [
    { title: 'ID', dataIndex: 'id', width: 50 },
    { title: '渠道', dataIndex: 'channel', width: 80, render: (v: string) => <Tag>{v}</Tag> },
    { title: '服务商', dataIndex: 'provider', width: 100 },
    {
      title: '默认', dataIndex: 'isDefault', width: 60,
      render: (v: number) => v ? <Tag color="blue">是</Tag> : '否',
    },
    {
      title: '状态', dataIndex: 'enabled', width: 70,
      render: (v: number) => v ? <Tag color="green">启用</Tag> : <Tag>禁用</Tag>,
    },
    { title: '描述', dataIndex: 'description', ellipsis: true },
    {
      title: '操作', width: 80,
      render: (_: any, r: any) => <a onClick={() => openEdit(r)}>配置</a>,
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
        <h3>渠道服务商配置</h3>
        <Button onClick={handleTestSmtp} loading={testing}>测试 SMTP 连接</Button>
      </div>
      <Table rowKey="id" columns={columns} dataSource={data} loading={loading} pagination={false} size="small" />
      <Drawer title="编辑渠道配置" open={drawerOpen} width={480} onClose={() => setDrawerOpen(false)}
        extra={<Button type="primary" onClick={handleSave}>保存</Button>}>
        <Form form={form} layout="vertical">
          <Form.Item name="host" label="SMTP 主机"><Input /></Form.Item>
          <Form.Item name="port" label="端口"><InputNumber style={{ width: '100%' }} /></Form.Item>
          <Form.Item name="secure" label="SSL" valuePropName="checked"><Switch /></Form.Item>
          <Form.Item name="auth_user" label="用户名"><Input /></Form.Item>
          <Form.Item name="auth_pass" label="密码"><Input.Password /></Form.Item>
          <Form.Item name="enabled" label="启用" valuePropName="checked"><Switch /></Form.Item>
          <Form.Item name="description" label="描述"><Input /></Form.Item>
        </Form>
      </Drawer>
    </div>
  );
};
