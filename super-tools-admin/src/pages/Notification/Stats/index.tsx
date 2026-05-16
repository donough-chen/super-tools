import React, { useState, useEffect } from 'react';
import { Tabs, DatePicker, Button, Card, Statistic, Row, Col, Table, Modal, Form, Input, Select, message } from 'antd';
import dayjs from 'dayjs';
import { NotificationStatsApi, NotificationExportApi } from '@/services/notification';

const { RangePicker } = DatePicker;

export default function StatsPage() {
  const [range, setRange] = useState<[dayjs.Dayjs, dayjs.Dayjs]>([dayjs().subtract(7, 'day'), dayjs()]);
  const [exportOpen, setExportOpen] = useState(false);
  const params = { from: range[0].toISOString(), to: range[1].toISOString() };

  return (
    <div style={{ padding: 24 }}>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
        <h2>通知统计</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <RangePicker value={range as any} onChange={(v) => v && setRange(v as any)} />
          <Button type="primary" onClick={() => setExportOpen(true)}>导出 Excel</Button>
        </div>
      </div>
      <Tabs defaultActiveKey="ov" items={[
        { key: 'ov', label: '概览', children: <OverviewTab params={params} /> },
        { key: 'tr', label: '趋势', children: <TrendTab params={params} /> },
        { key: 'di', label: '分布', children: <DistributionTab params={params} /> },
        { key: 'fn', label: '漏斗', children: <FunnelTab params={params} /> },
      ]} />
      <ExportModal open={exportOpen} range={range} onClose={() => setExportOpen(false)} />
    </div>
  );
}

// ======== Overview Tab ========
function OverviewTab({ params }: { params: any }) {
  const [data, setData] = useState<any>(null);
  useEffect(() => {
    NotificationStatsApi.overview(params).then((r: any) => setData(r?.data));
  }, [params.from, params.to]);
  if (!data) return <div>加载中...</div>;
  return (
    <Row gutter={16}>
      <Col span={4}><Card><Statistic title="总数" value={data.total} /></Card></Col>
      <Col span={4}><Card><Statistic title="已发送" value={data.sent} /></Card></Col>
      <Col span={4}><Card><Statistic title="已送达" value={data.delivered} /></Card></Col>
      <Col span={4}><Card><Statistic title="失败" value={data.failed} valueStyle={{ color: '#ff4d4f' }} /></Card></Col>
      <Col span={4}><Card><Statistic title="跳过" value={data.skipped} /></Card></Col>
      <Col span={4}><Card><Statistic title="阅读率" value={`${(data.readRate * 100).toFixed(1)}%`} /></Card></Col>
    </Row>
  );
}

// ======== Trend Tab ========
function TrendTab({ params }: { params: any }) {
  const [data, setData] = useState<any[]>([]);
  const [granularity, setGranularity] = useState<'day' | 'hour'>('day');
  useEffect(() => {
    NotificationStatsApi.trend({ ...params, granularity }).then((r: any) => setData(r?.data || []));
  }, [params.from, params.to, granularity]);
  return (
    <div>
      <Select value={granularity} onChange={setGranularity} style={{ marginBottom: 16, width: 120 }}>
        <Select.Option value="day">按天</Select.Option>
        <Select.Option value="hour">按小时</Select.Option>
      </Select>
      <Table dataSource={data} rowKey="ts" size="small" pagination={false} columns={[
        { title: '时间', dataIndex: 'ts', key: 'ts' },
        { title: '总数', dataIndex: 'total', key: 'total' },
        { title: '已发送', dataIndex: 'sent', key: 'sent' },
        { title: '已送达', dataIndex: 'delivered', key: 'delivered' },
      ]} />
    </div>
  );
}

// ======== Distribution Tab ========
function DistributionTab({ params }: { params: any }) {
  const [channelData, setChannelData] = useState<any[]>([]);
  const [typeData, setTypeData] = useState<any[]>([]);
  useEffect(() => {
    NotificationStatsApi.byChannel(params).then((r: any) => setChannelData(r?.data || []));
    NotificationStatsApi.byType({ ...params, limit: 10 }).then((r: any) => setTypeData(r?.data || []));
  }, [params.from, params.to]);
  return (
    <Row gutter={16}>
      <Col span={12}>
        <Card title="按渠道">
          <Table dataSource={channelData} rowKey="channel" size="small" pagination={false} columns={[
            { title: '渠道', dataIndex: 'channel' },
            { title: '总数', dataIndex: 'total' },
            { title: '成功', dataIndex: 'success' },
            { title: '失败', dataIndex: 'fail' },
          ]} />
        </Card>
      </Col>
      <Col span={12}>
        <Card title="Top 通知类型">
          <Table dataSource={typeData} rowKey="typeKey" size="small" pagination={false} columns={[
            { title: '类型', dataIndex: 'name' },
            { title: '总数', dataIndex: 'total' },
            { title: '已发送', dataIndex: 'sent' },
          ]} />
        </Card>
      </Col>
    </Row>
  );
}

// ======== Funnel Tab ========
function FunnelTab({ params }: { params: any }) {
  const [data, setData] = useState<any>(null);
  useEffect(() => {
    NotificationStatsApi.funnel(params).then((r: any) => setData(r?.data));
  }, [params.from, params.to]);
  if (!data) return <div>加载中...</div>;
  const stages = [
    { name: '总数', value: data.total },
    { name: '已入队', value: data.queued },
    { name: '已发送', value: data.sent },
    { name: '已送达', value: data.delivered },
    { name: '已阅读', value: data.read },
  ];
  return (
    <Card>
      {stages.map((s, i) => (
        <div key={s.name} style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
          <div style={{ width: 80 }}>{s.name}</div>
          <div style={{
            height: 24,
            background: `hsl(${200 - i * 30}, 70%, 55%)`,
            width: `${data.total ? (s.value / data.total) * 100 : 0}%`,
            minWidth: 30,
            borderRadius: 4,
            display: 'flex',
            alignItems: 'center',
            paddingLeft: 8,
            color: '#fff',
            fontSize: 12,
          }}>
            {s.value}
          </div>
        </div>
      ))}
    </Card>
  );
}

// ======== Export Modal ========
function ExportModal({ open, range, onClose }: { open: boolean; range: [dayjs.Dayjs, dayjs.Dayjs]; onClose: () => void }) {
  const [form] = Form.useForm();
  const handleOk = async () => {
    const values = await form.validateFields();
    await NotificationExportApi.create({
      name: values.name || `导出-${dayjs().format('YYYY-MM-DD')}`,
      filter: {
        from: range[0].toISOString(),
        to: range[1].toISOString(),
        channel: values.channel || undefined,
        status: values.status || undefined,
      },
      recipientEmail: values.recipientEmail || undefined,
    });
    message.success('导出任务已提交，完成后将发送邮件通知');
    onClose();
    form.resetFields();
  };
  return (
    <Modal title="导出通知数据" open={open} onOk={handleOk} onCancel={onClose} okText="开始导出">
      <Form form={form} layout="vertical">
        <Form.Item name="name" label="导出名称">
          <Input placeholder="可选，默认使用日期" />
        </Form.Item>
        <Form.Item name="channel" label="渠道筛选">
          <Select allowClear placeholder="全部">
            <Select.Option value="in_app">站内信</Select.Option>
            <Select.Option value="email">邮件</Select.Option>
            <Select.Option value="sms">短信</Select.Option>
          </Select>
        </Form.Item>
        <Form.Item name="status" label="状态筛选">
          <Select allowClear placeholder="全部">
            <Select.Option value="sent">已发送</Select.Option>
            <Select.Option value="delivered">已送达</Select.Option>
            <Select.Option value="failed">失败</Select.Option>
          </Select>
        </Form.Item>
        <Form.Item name="recipientEmail" label="邮件通知（完成后发送到）">
          <Input placeholder="admin@example.com" />
        </Form.Item>
      </Form>
    </Modal>
  );
}
