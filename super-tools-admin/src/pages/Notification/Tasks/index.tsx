import React, { useEffect, useState } from 'react';
import { Table, Button, Tag, Space, Drawer, Form, Input, Select, InputNumber, message } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { listTasks, createTask, detailTask, createScheduledTask, pauseTask, resumeTask, cancelTask, undoTask } from '@/services/notification';

const statusColors: any = {
  pending: 'default', running: 'processing', completed: 'success', failed: 'error',
};

export default () => {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const [detailData, setDetailData] = useState<any>(null);
  const [form] = Form.useForm();

  const fetch = async () => {
    setLoading(true);
    try {
      const res = await listTasks({ page, pageSize: 20 });
      if (res?.code === 200) {
        setData(res.data?.list || []);
        setTotal(res.data?.total || 0);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetch(); }, [page]);

  const handleCreate = async () => {
    const values = await form.validateFields();
    const payload = {
      ...values,
      staticUserIds: values.staticUserIds ? values.staticUserIds.split(',').map(Number) : [],
      variables: values.variables ? JSON.parse(values.variables) : {},
    };
    await createTask(payload);
    message.success('任务创建成功，正在执行...');
    setCreateOpen(false);
    form.resetFields();
    setTimeout(fetch, 1000);
  };

  const showDetail = async (id: number) => {
    const res = await detailTask(id);
    if (res?.code === 200) setDetailData(res.data?.task);
  };

  const columns = [
    { title: 'ID', dataIndex: 'id', width: 60 },
    { title: '名称', dataIndex: 'name', width: 200 },
    {
      title: '状态', dataIndex: 'status', width: 100,
      render: (v: string) => <Tag color={statusColors[v] || 'default'}>{v}</Tag>,
    },
    { title: '总数', dataIndex: 'totalCount', width: 70 },
    { title: '成功', dataIndex: 'successCount', width: 70 },
    { title: '失败', dataIndex: 'failCount', width: 70 },
    { title: '来源', dataIndex: 'source', width: 80 },
    { title: '创建时间', dataIndex: 'createdAt', width: 170 },
    {
      title: '操作', width: 80,
      render: (_: any, r: any) => <a onClick={() => showDetail(r.id)}>详情</a>,
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
        <h3>通知任务</h3>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => { form.resetFields(); setCreateOpen(true); }}>
          立即发送
        </Button>
      </div>
      <Table
        rowKey="id" columns={columns} dataSource={data} loading={loading}
        pagination={{ current: page, total, pageSize: 20, onChange: setPage }}
        size="small" scroll={{ x: 900 }}
      />
      <Drawer title="创建发送任务" open={createOpen} width={480} onClose={() => setCreateOpen(false)}
        extra={<Button type="primary" onClick={handleCreate}>确认发送</Button>}>
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="任务名称" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="typeId" label="通知类型 ID" rules={[{ required: true }]}><InputNumber style={{ width: '100%' }} /></Form.Item>
          <Form.Item name="audienceType" label="受众类型" rules={[{ required: true }]} initialValue="static">
            <Select options={[{ label: '全部用户', value: 'all' }, { label: '指定用户', value: 'static' }]} />
          </Form.Item>
          <Form.Item name="staticUserIds" label="用户ID列表（逗号分隔）"><Input placeholder="如 1,2,3" /></Form.Item>
          <Form.Item name="variables" label="模板变量（JSON）" initialValue="{}">
            <Input.TextArea rows={4} />
          </Form.Item>
        </Form>
      </Drawer>
      <Drawer title="任务详情" open={!!detailData} onClose={() => setDetailData(null)} width={480}>
        {detailData && (
          <div>
            <p><strong>名称：</strong>{detailData.name}</p>
            <p><strong>状态：</strong><Tag color={statusColors[detailData.status]}>{detailData.status}</Tag></p>
            <p><strong>调度类型：</strong>{detailData.scheduleType}</p>
            <p><strong>总数：</strong>{detailData.totalCount} | 成功：{detailData.successCount} | 失败：{detailData.failCount}</p>
            <p><strong>开始：</strong>{detailData.startedAt}</p>
            <p><strong>结束：</strong>{detailData.finishedAt || '-'}</p>
            {detailData.nextFireAt && <p><strong>下次触发：</strong>{detailData.nextFireAt}</p>}
            {detailData.cronExpression && <p><strong>Cron：</strong>{detailData.cronExpression}</p>}
            {detailData.rrule && <p><strong>RRULE：</strong>{detailData.rrule}</p>}
            {detailData.errorMessage && <p style={{ color: '#ff4d4f' }}><strong>错误：</strong>{detailData.errorMessage}</p>}
            <div style={{ marginTop: 16, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {['running', 'scheduled'].includes(detailData.status) && (
                <Button size="small" onClick={async () => { await pauseTask(detailData.id); message.success('已暂停'); showDetail(detailData.id); }}>暂停</Button>
              )}
              {detailData.status === 'paused' && (
                <Button size="small" type="primary" onClick={async () => { await resumeTask(detailData.id); message.success('已恢复'); showDetail(detailData.id); }}>恢复</Button>
              )}
              {!['completed', 'canceled'].includes(detailData.status) && (
                <Button size="small" danger onClick={async () => { await cancelTask(detailData.id); message.success('已取消'); showDetail(detailData.id); }}>取消</Button>
              )}
              {detailData.scheduleType === 'immediate' && detailData.undoWindowSec > 0 && detailData.status === 'scheduled' && (
                <Button size="small" onClick={async () => { await undoTask(detailData.id); message.success('已撤销'); showDetail(detailData.id); }}>撤销</Button>
              )}
            </div>
          </div>
        )}
      </Drawer>
    </div>
  );
};
