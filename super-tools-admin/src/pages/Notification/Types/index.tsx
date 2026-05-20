import React, { useEffect, useState } from 'react';
import { Table, Button, Space, Tag, Switch, Modal, Form, Input, Select, message, Popconfirm } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { listTypes, createType, updateType, deleteType } from '@/services/notification';

const categoryOptions = [
  { label: '系统', value: 'system' },
  { label: '业务', value: 'business' },
  { label: '营销', value: 'marketing' },
];

const channelOptions = [
  { label: '站内信', value: 'in_app' },
  { label: '邮件', value: 'email' },
  { label: '短信', value: 'sms' },
];

export default () => {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form] = Form.useForm();

  const fetch = async () => {
    setLoading(true);
    try {
      const res = await listTypes({ page, pageSize: 20 });
      if (res?.code === 200) {
        setData(res.data?.list || []);
        setTotal(res.data?.total || 0);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetch(); }, [page]);

  const handleSave = async () => {
    const values = await form.validateFields();
    if (editing) {
      await updateType(editing.id, values);
      message.success('更新成功');
    } else {
      await createType(values);
      message.success('创建成功');
    }
    setModalOpen(false);
    form.resetFields();
    setEditing(null);
    fetch();
  };

  const handleDelete = async (id: number) => {
    await deleteType(id);
    message.success('删除成功');
    fetch();
  };

  const handleStatusToggle = async (record: any) => {
    await updateType(record.id, { status: record.status ? 0 : 1 });
    message.success('状态已更新');
    fetch();
  };

  const columns = [
    { title: 'ID', dataIndex: 'id', width: 60 },
    { title: '编码', dataIndex: 'code', width: 200 },
    { title: '名称', dataIndex: 'name', width: 120 },
    {
      title: '分类', dataIndex: 'category', width: 80,
      render: (v: string) => {
        const map: any = { system: '系统', business: '业务', marketing: '营销' };
        return <Tag>{map[v] || v}</Tag>;
      },
    },
    {
      title: '默认渠道', dataIndex: 'defaultChannels', width: 160,
      render: (v: string[]) => v?.map((c: string) => <Tag key={c}>{c}</Tag>),
    },
    { title: '优先级', dataIndex: 'priority', width: 70 },
    { title: '图标', dataIndex: 'icon', width: 70 },
    {
      title: '状态', dataIndex: 'status', width: 80,
      render: (_: any, r: any) => (
        <Switch checked={!!r.status} onChange={() => handleStatusToggle(r)} disabled={!!r.isSystem} size="small" />
      ),
    },
    {
      title: '系统内置', dataIndex: 'isSystem', width: 80,
      render: (v: number) => v ? <Tag color="blue">是</Tag> : '否',
    },
    {
      title: '操作', width: 140,
      render: (_: any, r: any) => (
        <Space size="small">
          <a onClick={() => { setEditing(r); form.setFieldsValue(r); setModalOpen(true); }}>编辑</a>
          {!r.isSystem && (
            <Popconfirm title="确认删除？" onConfirm={() => handleDelete(r.id)}>
              <a style={{ color: '#ff4d4f' }}>删除</a>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
        <h3>通知类型管理</h3>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditing(null); form.resetFields(); setModalOpen(true); }}>
          新增类型
        </Button>
      </div>
      <Table
        rowKey="id" columns={columns} dataSource={data} loading={loading}
        pagination={{ current: page, total, pageSize: 20, onChange: setPage }}
        size="small" scroll={{ x: 900 }}
      />
      <Modal
        title={editing ? '编辑类型' : '新增类型'} open={modalOpen}
        onOk={handleSave} onCancel={() => { setModalOpen(false); setEditing(null); }}
        destroyOnClose
      >
        <Form form={form} layout="vertical">
          <Form.Item name="code" label="编码" rules={[{ required: true }]}>
            <Input disabled={!!editing} placeholder="如 BUSINESS_FEEDBACK_REPLY" />
          </Form.Item>
          <Form.Item name="name" label="名称" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="category" label="分类" rules={[{ required: true }]}>
            <Select options={categoryOptions} />
          </Form.Item>
          <Form.Item name="defaultChannels" label="默认渠道" rules={[{ required: true }]}>
            <Select mode="multiple" options={channelOptions} />
          </Form.Item>
          <Form.Item name="priority" label="优先级" initialValue={2}>
            <Select options={[{ label: 'P0 紧急', value: 0 }, { label: 'P1 高', value: 1 }, { label: 'P2 普通', value: 2 }, { label: 'P3 低', value: 3 }]} />
          </Form.Item>
          <Form.Item name="icon" label="图标" initialValue={''}>
            <Input />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};
