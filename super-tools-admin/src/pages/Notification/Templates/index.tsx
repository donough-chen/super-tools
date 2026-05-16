import React, { useEffect, useState } from 'react';
import { Table, Button, Space, Tag, Drawer, Form, Input, Select, message, Modal } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { listTemplates, createTemplate, updateTemplate, publishTemplate, previewTemplate } from '@/services/notification';

const channelOpts = [
  { label: '站内信', value: 'in_app' },
  { label: '邮件', value: 'email' },
  { label: '短信', value: 'sms' },
];

const statusMap: any = { 0: { text: '草稿', color: 'default' }, 1: { text: '已发布', color: 'green' }, 2: { text: '已停用', color: 'red' } };

export default () => {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [previewResult, setPreviewResult] = useState<any>(null);
  const [form] = Form.useForm();

  const fetch = async () => {
    setLoading(true);
    try {
      const res = await listTemplates({ page, pageSize: 20 });
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
      await updateTemplate(editing.id, values);
      message.success('更新成功');
    } else {
      await createTemplate(values);
      message.success('创建成功');
    }
    setDrawerOpen(false);
    form.resetFields();
    setEditing(null);
    fetch();
  };

  const handlePublish = async (id: number) => {
    await publishTemplate(id);
    message.success('发布成功');
    fetch();
  };

  const handlePreview = async (record: any) => {
    const res = await previewTemplate(record.id, record.sampleVariables || {});
    if (res?.code === 200) {
      setPreviewResult(res.data);
    }
  };

  const columns = [
    { title: 'ID', dataIndex: 'id', width: 60 },
    { title: '编码', dataIndex: 'code', width: 180 },
    { title: '名称', dataIndex: 'name', width: 120 },
    { title: '渠道', dataIndex: 'channel', width: 80, render: (v: string) => <Tag>{v}</Tag> },
    { title: '版本', dataIndex: 'currentVersion', width: 60 },
    {
      title: '状态', dataIndex: 'status', width: 80,
      render: (v: number) => {
        const s = statusMap[v] || { text: v, color: 'default' };
        return <Tag color={s.color}>{s.text}</Tag>;
      },
    },
    { title: '类型', dataIndex: ['type', 'name'], width: 100 },
    {
      title: '操作', width: 200,
      render: (_: any, r: any) => (
        <Space size="small">
          <a onClick={() => { setEditing(r); form.setFieldsValue(r); setDrawerOpen(true); }}>编辑</a>
          <a onClick={() => handlePreview(r)}>预览</a>
          {r.status === 0 && <a onClick={() => handlePublish(r.id)} style={{ color: '#52c41a' }}>发布</a>}
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
        <h3>通知模板管理</h3>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditing(null); form.resetFields(); setDrawerOpen(true); }}>
          新增模板
        </Button>
      </div>
      <Table
        rowKey="id" columns={columns} dataSource={data} loading={loading}
        pagination={{ current: page, total, pageSize: 20, onChange: setPage }}
        size="small" scroll={{ x: 900 }}
      />
      <Drawer
        title={editing ? '编辑模板' : '新增模板'} open={drawerOpen} width={560}
        onClose={() => { setDrawerOpen(false); setEditing(null); }}
        extra={<Button type="primary" onClick={handleSave}>保存</Button>}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="typeId" label="类型ID" rules={[{ required: true }]}><Input type="number" /></Form.Item>
          <Form.Item name="code" label="编码" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="name" label="名称" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="channel" label="渠道" rules={[{ required: true }]}><Select options={channelOpts} /></Form.Item>
          <Form.Item name="titleTemplate" label="标题模板"><Input placeholder="如：你好 {{user.name}}" /></Form.Item>
          <Form.Item name="contentTemplate" label="内容模板" rules={[{ required: true }]}>
            <Input.TextArea rows={6} placeholder="支持 {{variable}} 占位符" />
          </Form.Item>
          <Form.Item name="description" label="描述"><Input.TextArea rows={2} /></Form.Item>
        </Form>
      </Drawer>
      <Modal title="模板预览" open={!!previewResult} onCancel={() => setPreviewResult(null)} footer={null}>
        {previewResult && (
          <div>
            <p><strong>标题：</strong>{previewResult.title}</p>
            <p><strong>内容：</strong></p>
            <div style={{ background: '#f5f5f5', padding: 12, borderRadius: 4 }} dangerouslySetInnerHTML={{ __html: previewResult.content }} />
            {previewResult.missingVars?.length > 0 && (
              <p style={{ color: '#faad14', marginTop: 8 }}>缺失变量：{previewResult.missingVars.join(', ')}</p>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
};
