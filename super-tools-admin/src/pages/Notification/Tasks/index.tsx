import React, { useEffect, useState, useCallback } from 'react';
import {
  Table, Button, Tag, Space, Drawer, Form, Input, Select,
  InputNumber, message, Tabs, Statistic, Row, Col, Steps,
  DatePicker, Popconfirm, Divider, Progress, Alert, Tooltip,
} from 'antd';
import {
  PlusOutlined, ThunderboltOutlined, ClockCircleOutlined,
  SyncOutlined, CalendarOutlined, InfoCircleOutlined,
  PauseCircleOutlined, PlayCircleOutlined, StopOutlined, RollbackOutlined,
} from '@ant-design/icons';
import NotificationTypeSelect, { NotificationTypeOption } from '@/components/NotificationTypeSelect';
import {
  listTasks, createTask, detailTask, pauseTask, resumeTask,
  cancelTask, undoTask, listTypes, listTemplates,
} from '@/services/notification';
import { listAudiences } from '@/services/notification-audience';
import dayjs from 'dayjs';

// ==================== 常量 ====================

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  pending:   { label: '等待中', color: 'default' },
  scheduled: { label: '已调度', color: 'blue' },
  running:   { label: '执行中', color: 'processing' },
  paused:    { label: '已暂停', color: 'warning' },
  completed: { label: '已完成', color: 'success' },
  failed:    { label: '失败',   color: 'error' },
  canceled:  { label: '已取消', color: 'default' },
};

const SEND_TYPE_CARDS = [
  {
    value: 'immediate',
    icon: <ThunderboltOutlined style={{ fontSize: 28, color: '#1677ff' }} />,
    title: '立即发送',
    desc: '创建后立即执行，可设置撤销窗口',
  },
  {
    value: 'scheduled',
    icon: <ClockCircleOutlined style={{ fontSize: 28, color: '#52c41a' }} />,
    title: '定时发送',
    desc: '指定时间点执行，至少 30 秒后',
  },
  {
    value: 'cron',
    icon: <SyncOutlined style={{ fontSize: 28, color: '#fa8c16' }} />,
    title: 'Cron 周期',
    desc: '按 Cron 表达式周期性执行',
  },
  {
    value: 'rrule',
    icon: <CalendarOutlined style={{ fontSize: 28, color: '#722ed1' }} />,
    title: 'RRULE 规则',
    desc: 'RFC 5545 复杂重复规则',
  },
];

const CRON_PRESETS = [
  { label: '每天 8:00', value: '0 8 * * *' },
  { label: '每天 12:00', value: '0 12 * * *' },
  { label: '每天 20:00', value: '0 20 * * *' },
  { label: '每周一 9:00', value: '0 9 * * 1' },
  { label: '工作日 9:00', value: '0 9 * * 1-5' },
  { label: '每月 1 号', value: '0 10 1 * *' },
];

// ==================== 发送类型选择卡片 ====================

const SendTypeSelector: React.FC<{ value?: string; onChange?: (v: string) => void }> = ({ value, onChange }) => (
  <Row gutter={12}>
    {SEND_TYPE_CARDS.map(card => (
      <Col span={12} key={card.value} style={{ marginBottom: 12 }}>
        <div
          onClick={() => onChange?.(card.value)}
          style={{
            border: `2px solid ${value === card.value ? '#1677ff' : '#f0f0f0'}`,
            borderRadius: 8,
            padding: '16px 14px',
            cursor: 'pointer',
            background: value === card.value ? '#e6f4ff' : '#fff',
            transition: 'all 0.2s',
            display: 'flex',
            alignItems: 'flex-start',
            gap: 12,
          }}
        >
          <div style={{ flexShrink: 0, marginTop: 2 }}>{card.icon}</div>
          <div>
            <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>{card.title}</div>
            <div style={{ fontSize: 12, color: '#8c8c8c', lineHeight: 1.5 }}>{card.desc}</div>
          </div>
        </div>
      </Col>
    ))}
  </Row>
);

// ==================== 主页面 ====================

export default () => {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [activeTab, setActiveTab] = useState('all');

  // 统计
  const [stats, setStats] = useState({ total: 0, running: 0, completed: 0, failed: 0 });

  // 创建 Drawer
  const [createOpen, setCreateOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);

  // 详情 Drawer
  const [detailData, setDetailData] = useState<any>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // 类型选项
  const [typeOptions, setTypeOptions] = useState<NotificationTypeOption[]>([]);
  const [typeLoading, setTypeLoading] = useState(false);

  // 模板选项
  const [templateOptions, setTemplateOptions] = useState<any[]>([]);
  const [templateLoading, setTemplateLoading] = useState(false);

  // 受众分组选项
  const [audienceOptions, setAudienceOptions] = useState<any[]>([]);
  const [audienceLoading, setAudienceLoading] = useState(false);

  // 监听发送类型
  const sendTypeWatch = Form.useWatch('sendType', form);
  const audienceTypeWatch = Form.useWatch('audienceType', form);
  const typeIdWatch = Form.useWatch('typeId', form);

  const fetchList = useCallback(async () => {
    setLoading(true);
    try {
      const params: any = { page, pageSize: 20 };
      if (activeTab !== 'all') params.status = activeTab;
      const res = await listTasks(params);
      if (res?.code === 200) {
        const list: any[] = res.data?.list || [];
        setData(list);
        setTotal(res.data?.total || 0);
        // 更新统计
        setStats({
          total: res.data?.total || 0,
          running: list.filter(t => t.status === 'running').length,
          completed: list.filter(t => t.status === 'completed').length,
          failed: list.filter(t => t.status === 'failed').length,
        });
      }
    } finally { setLoading(false); }
  }, [page, activeTab]);

  useEffect(() => { fetchList(); }, [fetchList]);

  useEffect(() => {
    const loadTypes = async () => {
      setTypeLoading(true);
      try {
        const res = await listTypes({ pageSize: 200 });
        if (res?.code === 200) {
          setTypeOptions(
            (res.data?.list || [])
              .filter((i: any) => i.status === 1)
              .map((i: any) => ({ label: `${i.name}[${i.id}] (${i.code})`, value: i.id })),
          );
        }
      } finally { setTypeLoading(false); }
    };
    loadTypes();
  }, []);

  // 加载受众分组
  useEffect(() => {
    const loadAudiences = async () => {
      setAudienceLoading(true);
      try {
        const res = await listAudiences({ pageSize: 200 });
        if (res?.code === 200) {
          setAudienceOptions(
            (res.data?.list || []).map((a: any) => ({
              label: `${a.name}（${a.audienceType === 'all' ? '全部用户' : a.audienceType === 'static' ? '静态' : '动态规则'}${a.cachedCount != null ? `，约 ${a.cachedCount} 人` : ''}）`,
              value: a.id,
              audienceType: a.audienceType,
            })),
          );
        }
      } finally { setAudienceLoading(false); }
    };
    loadAudiences();
  }, []);

  // 根据选中的通知类型加载对应模板
  useEffect(() => {
    if (!typeIdWatch) { setTemplateOptions([]); return; }
    const loadTemplates = async () => {
      setTemplateLoading(true);
      try {
        const res = await listTemplates({ typeId: typeIdWatch, status: 1, pageSize: 100 });
        if (res?.code === 200) {
          setTemplateOptions(
            (res.data?.list || []).map((t: any) => ({
              label: `[${t.channel}] ${t.name}（v${t.currentVersion}）`,
              value: t.code,
            })),
          );
        }
      } finally { setTemplateLoading(false); }
    };
    loadTemplates();
  }, [typeIdWatch]);

  // ---- 创建任务 ----
  const handleCreate = async () => {
    try { await form.validateFields(); } catch { return; }
    const values = form.getFieldsValue(true);
    const payload: any = {
      name: values.name,
      typeId: values.typeId,
      templateCode: values.templateCode,
      channels: values.channels || ['in_app'],
      audienceType: values.audienceType || 'static',
      variables: (() => { try { return JSON.parse(values.variables || '{}'); } catch { return {}; } })(),
      sendType: values.sendType || 'immediate',
      priority: values.priority || 2,
      description: values.description,
    };
    if (payload.audienceType === 'audience') {
      // 选择了具体受众分组，传 audienceId，后端自动解析
      payload.audienceId = values.audienceId;
      delete payload.audienceType;
    } else if (payload.audienceType === 'static') {
      payload.staticUserIds = (values.staticUserIds || '').split(',').map(Number).filter(Boolean);
    }
    if (payload.sendType === 'immediate' && values.undoWindowSec) {
      payload.undoWindowSec = Number(values.undoWindowSec);
    }
    if (payload.sendType === 'scheduled' && values.scheduledAt) {
      payload.scheduledAt = dayjs(values.scheduledAt).toISOString();
    }
    if (payload.sendType === 'cron') payload.cronExpression = values.cronExpression;
    if (payload.sendType === 'rrule') payload.rrule = values.rrule;

    setSubmitting(true);
    try {
      await createTask(payload);
      message.success('任务创建成功');
      setCreateOpen(false);
      form.resetFields();
      setStep(0);
      setTimeout(fetchList, 800);
    } finally { setSubmitting(false); }
  };

  // ---- 详情 ----
  const showDetail = async (id: number) => {
    setDetailData(null);
    setDetailLoading(true);
    const res = await detailTask(id);
    if (res?.code === 200) setDetailData(res.data?.task || res.data);
    setDetailLoading(false);
  };

  // ---- Step 校验 ----
  const handleNextStep = async () => {
    if (step === 0) {
      try { await form.validateFields(['sendType']); setStep(1); } catch { }
    } else if (step === 1) {
      try { await form.validateFields(['name', 'typeId', 'templateCode', 'audienceType', 'audienceId']); setStep(2); } catch { }
    }
  };

  // ==================== 表格列 ====================
  const columns = [
    { title: 'ID', dataIndex: 'id', width: 60 },
    { title: '任务名称', dataIndex: 'name', width: 200 },
    {
      title: '状态', dataIndex: 'status', width: 100,
      render: (v: string) => {
        const c = STATUS_CONFIG[v] || { label: v, color: 'default' };
        return <Tag color={c.color}>{c.label}</Tag>;
      },
    },
    {
      title: '进度', width: 140,
      render: (_: any, r: any) => {
        if (!r.totalCount) return '-';
        const pct = Math.round((r.successCount / r.totalCount) * 100);
        return (
          <Tooltip title={`成功 ${r.successCount} / 总 ${r.totalCount}，失败 ${r.failCount}`}>
            <Progress percent={pct} size="small" status={r.failCount > 0 ? 'exception' : undefined} />
          </Tooltip>
        );
      },
    },
    { title: '调度类型', dataIndex: 'scheduleType', width: 90 },
    { title: '来源', dataIndex: 'source', width: 70 },
    { title: '创建时间', dataIndex: 'createdAt', width: 160 },
    {
      title: '操作', width: 60,
      render: (_: any, r: any) => <a onClick={() => showDetail(r.id)}>详情</a>,
    },
  ];

  // ==================== 渲染 ====================
  return (
    <div style={{ padding: 24 }}>
      {/* 统计卡片 */}
      <Row gutter={16} style={{ marginBottom: 20 }}>
        {[
          { label: '全部任务', value: stats.total, color: '#1677ff' },
          { label: '执行中', value: stats.running, color: '#52c41a' },
          { label: '已完成', value: stats.completed, color: '#8c8c8c' },
          { label: '失败', value: stats.failed, color: '#ff4d4f' },
        ].map(s => (
          <Col span={6} key={s.label}>
            <div style={{ background: '#fff', border: '1px solid #f0f0f0', borderRadius: 8, padding: '16px 20px' }}>
              <Statistic title={s.label} value={s.value} valueStyle={{ color: s.color, fontSize: 24 }} />
            </div>
          </Col>
        ))}
      </Row>

      {/* 状态 Tabs + 新建按钮 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <Tabs
          activeKey={activeTab} onChange={k => { setActiveTab(k); setPage(1); }} size="small"
          items={[
            { key: 'all', label: '全部' },
            { key: 'running', label: '执行中' },
            { key: 'scheduled', label: '已调度' },
            { key: 'completed', label: '已完成' },
            { key: 'failed', label: '失败' },
            { key: 'canceled', label: '已取消' },
          ]}
          style={{ marginBottom: 0 }}
        />
        <Button type="primary" icon={<PlusOutlined />} onClick={() => { form.resetFields(); setStep(0); setCreateOpen(true); }}>
          创建任务
        </Button>
      </div>

      <Table
        rowKey="id" columns={columns} dataSource={data} loading={loading}
        pagination={{ current: page, total, pageSize: 20, onChange: setPage, showTotal: t => `共 ${t} 条` }}
        size="small" scroll={{ x: 900 }}
      />

      {/* ===== 创建任务 Drawer ===== */}
      <Drawer
        title="创建发送任务" open={createOpen} width={680}
        onClose={() => { setCreateOpen(false); setStep(0); }}
        extra={
          <Space>
            {step > 0 && <Button onClick={() => setStep(s => s - 1)}>上一步</Button>}
            {step < 2 && <Button type="primary" onClick={handleNextStep}>下一步</Button>}
            {step === 2 && <Button type="primary" onClick={handleCreate} loading={submitting}>确认创建</Button>}
          </Space>
        }
      >
        <Steps
          current={step} size="small" style={{ marginBottom: 28 }}
          items={[
            { title: '发送方式' },
            { title: '受众 & 变量' },
            { title: '确认' },
          ]}
        />

        <Form form={form} layout="vertical">
          {/* ---- Step 0：发送类型 ---- */}
          <div style={{ display: step === 0 ? 'block' : 'none' }}>
            <Form.Item name="sendType" label="选择发送方式" rules={[{ required: true, message: '请选择发送方式' }]}>
              <SendTypeSelector />
            </Form.Item>

            {/* 立即发送：撤销窗口 */}
            {sendTypeWatch === 'immediate' && (
              <Form.Item name="undoWindowSec" label={<Space>撤销窗口（秒）<Tooltip title="创建后在此时间内可撤销，0 表示不可撤销"><InfoCircleOutlined /></Tooltip></Space>}>
                <InputNumber min={0} max={300} placeholder="如：60" style={{ width: '100%' }} />
              </Form.Item>
            )}

            {/* 定时发送：时间选择 */}
            {sendTypeWatch === 'scheduled' && (
              <Form.Item name="scheduledAt" label="定时发送时间" rules={[{ required: true, message: '请选择时间' }]}>
                <DatePicker
                  showTime style={{ width: '100%' }}
                  disabledDate={d => d && d.isBefore(dayjs().add(30, 'second'))}
                  placeholder="选择执行时间（至少 30 秒后）"
                />
              </Form.Item>
            )}

            {/* Cron */}
            {sendTypeWatch === 'cron' && (
              <Form.Item name="cronExpression" label="Cron 表达式" rules={[{ required: true, message: '请输入 Cron 表达式' }]}>
                <Input placeholder="如：0 8 * * *（每天 8:00）" addonAfter={
                  <Select
                    placeholder="预设" style={{ width: 120 }} size="small" bordered={false}
                    options={CRON_PRESETS}
                    onChange={v => form.setFieldValue('cronExpression', v)}
                  />
                } />
              </Form.Item>
            )}

            {/* RRULE */}
            {sendTypeWatch === 'rrule' && (
              <Form.Item name="rrule" label="RRULE 规则" rules={[{ required: true, message: '请输入 RRULE' }]}>
                <Input placeholder="如：FREQ=WEEKLY;INTERVAL=2;BYDAY=MO;BYHOUR=9" />
              </Form.Item>
            )}
          </div>

          {/* ---- Step 1：受众 & 变量 ---- */}
          <div style={{ display: step === 1 ? 'block' : 'none' }}>
            <Form.Item name="name" label="任务名称" rules={[{ required: true, message: '请输入任务名称' }]}>
              <Input placeholder="如：年中大促通知" />
            </Form.Item>
            <Form.Item name="typeId" label="通知类型" rules={[{ required: true, message: '请选择通知类型' }]}>
              <NotificationTypeSelect options={typeOptions} loading={typeLoading} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item noStyle shouldUpdate={(p, c) => p.typeId !== c.typeId}>
              {({ getFieldValue }) => {
                const opt = typeOptions.find(o => o.value === getFieldValue('typeId'));
                if (!opt) return null;
                const m = String(opt.label).match(/\(([^)]+)\)$/);
                return m ? (
                  <div style={{ marginTop: -16, marginBottom: 16, color: '#8c8c8c', fontSize: 12 }}>
                    code：<span style={{ fontFamily: 'monospace', color: '#595959' }}>{m[1]}</span>
                  </div>
                ) : null;
              }}
            </Form.Item>
            <Form.Item
              name="templateCode"
              label="通知模板"
              rules={[{ required: true, message: '请选择通知模板' }]}
              extra={!typeIdWatch ? '请先选择通知类型' : undefined}
            >
              <Select
                loading={templateLoading}
                placeholder={typeIdWatch ? '选择已发布的模板' : '请先选择通知类型'}
                disabled={!typeIdWatch}
                options={templateOptions}
              />
            </Form.Item>
            <Form.Item name="channels" label="发送渠道" initialValue={['in_app']}>
              <Select
                mode="multiple"
                options={[{ label: '站内信', value: 'in_app' }, { label: '邮件', value: 'email' }, { label: '短信', value: 'sms' }]}
              />
            </Form.Item>
            <Form.Item name="audienceType" label="受众类型" rules={[{ required: true }]} initialValue="static">
              <Select options={[
                { label: '全部用户', value: 'all' },
                { label: '指定用户（静态）', value: 'static' },
                { label: '受众分组', value: 'audience' },
              ]} />
            </Form.Item>
            {audienceTypeWatch === 'static' && (
              <Form.Item name="staticUserIds" label="用户 ID 列表（逗号分隔）">
                <Input.TextArea rows={2} placeholder="如：1,2,3,101" />
              </Form.Item>
            )}
            {audienceTypeWatch === 'audience' && (
              <Form.Item name="audienceId" label="选择受众分组" rules={[{ required: true, message: '请选择受众分组' }]}>
                <Select
                  loading={audienceLoading}
                  placeholder="选择已创建的受众分组"
                  options={audienceOptions}
                  showSearch
                  filterOption={(input, opt) => String(opt?.label || '').toLowerCase().includes(input.toLowerCase())}
                />
              </Form.Item>
            )}
            <Form.Item name="variables" label="模板变量（JSON）" initialValue="{}">
              <Input.TextArea rows={5} style={{ fontFamily: 'monospace', fontSize: 12 }} placeholder={'{\n  "user": { "name": "张三" }\n}'} />
            </Form.Item>
            <Form.Item name="priority" label="优先级（1-5，默认 2）" initialValue={2}>
              <InputNumber min={1} max={5} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item name="description" label="任务描述（可选）">
              <Input.TextArea rows={2} />
            </Form.Item>
          </div>

          {/* ---- Step 2：确认 ---- */}
          <div style={{ display: step === 2 ? 'block' : 'none' }}>
            {(() => {
              const v = form.getFieldsValue(true);
              const sendCard = SEND_TYPE_CARDS.find(c => c.value === v.sendType);
              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <Alert
                    type="warning" showIcon
                    message="请确认以下配置，创建后将立即调度执行。"
                  />
                  {[
                    { label: '任务名称', value: v.name },
                    { label: '发送方式', value: sendCard ? `${sendCard.title} — ${sendCard.desc}` : v.sendType },
                    v.sendType === 'scheduled' && { label: '定时时间', value: v.scheduledAt ? dayjs(v.scheduledAt).format('YYYY-MM-DD HH:mm:ss') : '-' },
                    v.sendType === 'cron' && { label: 'Cron 表达式', value: v.cronExpression },
                    v.sendType === 'rrule' && { label: 'RRULE', value: v.rrule },
                    v.sendType === 'immediate' && v.undoWindowSec && { label: '撤销窗口', value: `${v.undoWindowSec} 秒` },
                    { label: '受众类型', value: v.audienceType === 'all' ? '全部用户' : v.audienceType === 'static' ? `指定用户：${v.staticUserIds || '（未填写）'}` : v.audienceType === 'audience' ? `受众分组 ID：${v.audienceId || '（未选择）'}` : v.audienceType },
                    { label: '发送渠道', value: (v.channels || []).join(', ') },
                    { label: '优先级', value: v.priority },
                  ].filter(Boolean).map((item: any) => (
                    <div key={item.label} style={{ display: 'flex', gap: 8, padding: '8px 12px', background: '#fafafa', borderRadius: 6 }}>
                      <span style={{ color: '#8c8c8c', width: 90, flexShrink: 0 }}>{item.label}</span>
                      <span style={{ fontWeight: 500 }}>{item.value}</span>
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>
        </Form>
      </Drawer>

      {/* ===== 任务详情 Drawer ===== */}
      <Drawer
        title="任务详情" open={!!detailData} onClose={() => setDetailData(null)} width={520}
      >
        {detailLoading && <div style={{ textAlign: 'center', padding: 40, color: '#999' }}>加载中...</div>}
        {detailData && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* 基本信息 */}
            <div style={{ background: '#fafafa', borderRadius: 8, padding: 16 }}>
              <div style={{ fontWeight: 600, marginBottom: 12 }}>{detailData.name}</div>
              {[
                { label: '状态', value: <Tag color={STATUS_CONFIG[detailData.status]?.color}>{STATUS_CONFIG[detailData.status]?.label || detailData.status}</Tag> },
                { label: '调度类型', value: detailData.scheduleType },
                { label: '来源', value: detailData.source },
                { label: '创建时间', value: detailData.createdAt },
                { label: '开始时间', value: detailData.startedAt || '-' },
                { label: '结束时间', value: detailData.finishedAt || '-' },
                detailData.nextFireAt && { label: '下次触发', value: detailData.nextFireAt },
                detailData.cronExpression && { label: 'Cron', value: <code>{detailData.cronExpression}</code> },
                detailData.rrule && { label: 'RRULE', value: <code style={{ fontSize: 11 }}>{detailData.rrule}</code> },
              ].filter(Boolean).map((item: any) => (
                <div key={item.label} style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                  <span style={{ color: '#8c8c8c', width: 80, flexShrink: 0 }}>{item.label}</span>
                  <span>{item.value}</span>
                </div>
              ))}
            </div>

            {/* 进度 */}
            {detailData.totalCount > 0 && (
              <div style={{ background: '#fafafa', borderRadius: 8, padding: 16 }}>
                <div style={{ fontWeight: 600, marginBottom: 12 }}>执行进度</div>
                <Row gutter={16} style={{ marginBottom: 12 }}>
                  <Col span={8}><Statistic title="总数" value={detailData.totalCount} /></Col>
                  <Col span={8}><Statistic title="成功" value={detailData.successCount} valueStyle={{ color: '#52c41a' }} /></Col>
                  <Col span={8}><Statistic title="失败" value={detailData.failCount} valueStyle={{ color: '#ff4d4f' }} /></Col>
                </Row>
                <Progress
                  percent={Math.round((detailData.successCount / detailData.totalCount) * 100)}
                  status={detailData.failCount > 0 ? 'exception' : undefined}
                />
              </div>
            )}

            {/* 错误信息 */}
            {detailData.errorMessage && (
              <Alert type="error" showIcon message={detailData.errorMessage} />
            )}

            {/* 操作按钮 */}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {['running', 'scheduled'].includes(detailData.status) && (
                <Button icon={<PauseCircleOutlined />} onClick={async () => {
                  await pauseTask(detailData.id); message.success('已暂停'); showDetail(detailData.id);
                }}>暂停</Button>
              )}
              {detailData.status === 'paused' && (
                <Button type="primary" icon={<PlayCircleOutlined />} onClick={async () => {
                  await resumeTask(detailData.id); message.success('已恢复'); showDetail(detailData.id);
                }}>恢复</Button>
              )}
              {!['completed', 'canceled'].includes(detailData.status) && (
                <Popconfirm title="确认取消此任务？" onConfirm={async () => {
                  await cancelTask(detailData.id); message.success('已取消'); showDetail(detailData.id);
                }}>
                  <Button danger icon={<StopOutlined />}>取消</Button>
                </Popconfirm>
              )}
              {detailData.scheduleType === 'immediate' && detailData.undoWindowSec > 0 && detailData.status === 'scheduled' && (
                <Popconfirm title="确认撤销？撤销后任务不会执行。" onConfirm={async () => {
                  await undoTask(detailData.id); message.success('已撤销'); showDetail(detailData.id);
                }}>
                  <Button icon={<RollbackOutlined />}>撤销</Button>
                </Popconfirm>
              )}
            </div>
          </div>
        )}
      </Drawer>
    </div>
  );
};
