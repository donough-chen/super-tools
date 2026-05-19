import React, { useEffect, useState, useCallback } from 'react';
import {
  Table, Button, Space, Tag, Drawer, Form, Input, Select, message,
  Modal, Steps, Row, Col, Alert, Tooltip, Timeline, Popconfirm, Divider,
} from 'antd';
import {
  PlusOutlined, EyeOutlined, HistoryOutlined, SendOutlined,
  FileTextOutlined, SettingOutlined, RollbackOutlined,
} from '@ant-design/icons';
import NotificationTypeSelect, { NotificationTypeOption } from '@/components/NotificationTypeSelect';
import {
  listTemplates, createTemplate, updateTemplate, publishTemplate,
  previewTemplate, listTypes, detailTemplate, testSendTemplate,
} from '@/services/notification';
import form from 'antd/es/form';

// ==================== 常量 ====================

const CHANNEL_OPTS = [
  { label: '站内信', value: 'in_app' },
  { label: '邮件', value: 'email' },
  { label: '短信', value: 'sms' },
];

const CHANNEL_TAG: Record<string, { color: string; text: string }> = {
  in_app: { color: 'blue', text: '站内信' },
  email: { color: 'purple', text: '邮件' },
  sms: { color: 'orange', text: '短信' },
};

const STATUS_MAP: Record<number, { text: string; color: string }> = {
  0: { text: '草稿', color: 'default' },
  1: { text: '已发布', color: 'green' },
  2: { text: '已停用', color: 'red' },
};

// 从模板字符串提取变量占位符
function extractVars(tpl: string): string[] {
  const m = tpl?.match(/\{\{([\w.]+)\}\}/g) || [];
  return [...new Set(m.map(s => s.slice(2, -2)))];
}

// ==================== 实时预览面板 ====================

const PreviewPanel: React.FC<{
  titleTpl: string;
  contentTpl: string;
  channel: string;
  templateId?: number;
}> = ({ titleTpl, contentTpl, channel, templateId }) => {
  const [varJson, setVarJson] = useState('{}');
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [jsonError, setJsonError] = useState('');

  const allVars = [...new Set([...extractVars(titleTpl || ''), ...extractVars(contentTpl || '')])];

  const handlePreview = useCallback(async () => {
    let vars: any = {};
    try {
      vars = JSON.parse(varJson);
      setJsonError('');
    } catch {
      setJsonError('JSON 格式错误');
      return;
    }
    if (!templateId) {
      // 本地渲染（草稿未保存时）
      const simple = (tpl: string) =>
        tpl?.replace(/\{\{([\w.]+)\}\}/g, (_, p) => {
          const parts = p.split('.');
          let v: any = vars;
          for (const k of parts) v = v?.[k];
          return v !== undefined ? String(v) : `{{${p}}}`;
        }) || '';
      setResult({ title: simple(titleTpl), content: simple(contentTpl), missingVars: [] });
      return;
    }
    setLoading(true);
    try {
      const res = await previewTemplate(templateId, vars);
      if (res?.code === 200) setResult(res.data);
    } finally {
      setLoading(false);
    }
  }, [varJson, titleTpl, contentTpl, templateId]);

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ fontWeight: 600, fontSize: 13, color: '#595959' }}>
        <EyeOutlined style={{ marginRight: 6 }} />实时预览
      </div>

      {allVars.length > 0 && (
        <div>
          <div style={{ fontSize: 12, color: '#8c8c8c', marginBottom: 4 }}>
            模板变量：{allVars.map(v => (
              <Tag key={v} style={{ fontFamily: 'monospace', fontSize: 11 }}>{`{{${v}}}`}</Tag>
            ))}
          </div>
          <Input.TextArea
            rows={4}
            value={varJson}
            onChange={e => setVarJson(e.target.value)}
            placeholder={'{\n  "user": { "name": "张三" }\n}'}
            style={{ fontFamily: 'monospace', fontSize: 12 }}
          />
          {jsonError && <div style={{ color: '#ff4d4f', fontSize: 12, marginTop: 4 }}>{jsonError}</div>}
        </div>
      )}

      <Button size="small" type="primary" ghost onClick={handlePreview} loading={loading}>
        渲染预览
      </Button>

      {result && (
        <div style={{ flex: 1, overflow: 'auto' }}>
          {result.missingVars?.length > 0 && (
            <Alert
              type="warning" showIcon
              message={`缺失变量：${result.missingVars.join(', ')}`}
              style={{ marginBottom: 8, fontSize: 12 }}
            />
          )}
          {result.title && (
            <div style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 12, color: '#8c8c8c', marginBottom: 2 }}>标题</div>
              <div style={{ padding: '6px 10px', background: '#f5f5f5', borderRadius: 4, fontSize: 13 }}>
                {result.title}
              </div>
            </div>
          )}
          <div>
            <div style={{ fontSize: 12, color: '#8c8c8c', marginBottom: 2 }}>内容</div>
            <div
              style={{ padding: '10px 12px', background: '#f5f5f5', borderRadius: 4, fontSize: 13, whiteSpace: 'pre-wrap', minHeight: 80 }}
              dangerouslySetInnerHTML={channel === 'email' ? { __html: result.content } : undefined}
            >
              {channel !== 'email' ? result.content : undefined}
            </div>
          </div>
        </div>
      )}

      {!result && (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#bfbfbf', fontSize: 13 }}>
          点击"渲染预览"查看效果
        </div>
      )}
    </div>
  );
};

// ==================== 主页面 ====================

export default () => {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [filterChannel, setFilterChannel] = useState<string | undefined>();
  const [filterStatus, setFilterStatus] = useState<number | undefined>();

  // 编辑 Drawer
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [step, setStep] = useState(0);
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);

  // 版本历史 Drawer
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyData, setHistoryData] = useState<{ template: any; versions: any[] } | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [rollingBack, setRollingBack] = useState(false);

  // 测试发送 Modal
  const [testOpen, setTestOpen] = useState(false);
  const [testTarget, setTestTarget] = useState<any>(null);
  const [testUserId, setTestUserId] = useState('');
  const [testVarJson, setTestVarJson] = useState('{}');

  // 类型选项
  const [typeOptions, setTypeOptions] = useState<NotificationTypeOption[]>([]);
  const [typeLoading, setTypeLoading] = useState(false);

  // 实时预览所需的模板内容（Step2 时从 form 读取）
  const titleTplWatch = Form.useWatch('titleTemplate', form) || '';
  const contentTplWatch = Form.useWatch('contentTemplate', form) || '';
  const channelWatch = Form.useWatch('channel', form) || 'in_app';

  const fetchList = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listTemplates({ page, pageSize: 20, channel: filterChannel, status: filterStatus });
      if (res?.code === 200) {
        setData(res.data?.list || []);
        setTotal(res.data?.total || 0);
      }
    } finally {
      setLoading(false);
    }
  }, [page, filterChannel, filterStatus]);

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

  // ---- 打开编辑 ----
  const openEdit = (record?: any) => {
    setEditing(record || null);
    setStep(0);
    if (record) {
      form.setFieldsValue({
        ...record,
        typeId: record.typeId,
      });
    } else {
      form.resetFields();
    }
    setDrawerOpen(true);
  };

  // ---- 保存（草稿） ----
  const handleSave = async () => {
    try {
      await form.validateFields();
    } catch { return; }
    const values = form.getFieldsValue(true);
    setSaving(true);
    try {
      if (editing) {
        await updateTemplate(editing.id, values);
        message.success('更新成功');
      } else {
        await createTemplate(values);
        message.success('草稿已保存');
      }
      setDrawerOpen(false);
      fetchList();
    } finally { setSaving(false); }
  };

  // ---- 发布 ----
  const handlePublish = async (id: number) => {
    await publishTemplate(id);
    message.success('发布成功');
    fetchList();
  };

  // ---- 版本历史 ----
  const openHistory = async (record: any) => {
    setHistoryOpen(true);
    setHistoryData(null);
    setHistoryLoading(true);
    try {
      const res = await detailTemplate(record.id);
      if (res?.code === 200) setHistoryData(res.data);
    } finally { setHistoryLoading(false); }
  };

  const handleRollback = async (versionId: number) => {
    if (!historyData) return;
    setRollingBack(true);
    try {
      const res = await (fetch as any)(
        `/api/admin/notification/templates/${historyData.template.id}/rollback/${versionId}`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' } },
      ).then((r: any) => r.json());
      if (res?.code === 200) {
        message.success('回滚成功');
        setHistoryOpen(false);
        fetchList();
      } else {
        message.error(res?.message || '回滚失败');
      }
    } finally { setRollingBack(false); }
  };

  // ---- 测试发送 ----
  const openTestSend = (record: any) => {
    setTestTarget(record);
    setTestUserId('');
    setTestVarJson(JSON.stringify(record.sampleVariables || {}, null, 2));
    setTestOpen(true);
  };

  const handleTestSend = async () => {
    if (!testTarget) return;
    let vars: any = {};
    try { vars = JSON.parse(testVarJson); } catch { message.error('变量 JSON 格式错误'); return; }
    const uid = Number(testUserId);
    if (!uid) { message.error('请输入有效的用户 ID'); return; }
    const res = await testSendTemplate(testTarget.id, { userId: uid, variables: vars });
    if (res?.code === 200) { message.success('测试发送成功'); setTestOpen(false); }
    else message.error(res?.message || '发送失败');
  };

  // ---- Step 校验 ----
  const handleNextStep = async () => {
    try {
      await form.validateFields(['typeId', 'code', 'name', 'channel']);
      setStep(1);
    } catch { /* 校验失败，antd 自动提示 */ }
  };

  // ==================== 表格列 ====================
  const columns = [
    { title: 'ID', dataIndex: 'id', width: 60 },
    {
      title: '编码 / 名称', width: 220,
      render: (_: any, r: any) => (
        <div>
          <div style={{ fontFamily: 'monospace', fontSize: 12, color: '#595959' }}>{r.code}</div>
          <div style={{ fontSize: 13 }}>{r.name}</div>
        </div>
      ),
    },
    {
      title: '渠道', dataIndex: 'channel', width: 80,
      render: (v: string) => {
        const c = CHANNEL_TAG[v] || { color: 'default', text: v };
        return <Tag color={c.color}>{c.text}</Tag>;
      },
    },
    { title: 'v', dataIndex: 'currentVersion', width: 50, align: 'center' as const },
    {
      title: '状态', dataIndex: 'status', width: 80,
      render: (v: number) => {
        const s = STATUS_MAP[v] || { text: String(v), color: 'default' };
        return <Tag color={s.color}>{s.text}</Tag>;
      },
    },
    { title: '通知类型', dataIndex: ['type', 'name'], width: 100 },
    {
      title: '创建时间', dataIndex: 'created_at', width: 160,
      render: (v: string) => v ? new Date(v).toLocaleString('zh-CN') : '-',
    },
    {
      title: '操作', width: 220,
      render: (_: any, r: any) => (
        <Space size={4}>
          <a onClick={() => openEdit(r)}>编辑</a>
          <Divider type="vertical" />
          <Tooltip title="测试发送">
            <a onClick={() => openTestSend(r)}><SendOutlined /></a>
          </Tooltip>
          <Tooltip title="版本历史">
            <a onClick={() => openHistory(r)}><HistoryOutlined /></a>
          </Tooltip>
          {r.status === 0 && (
            <>
              <Divider type="vertical" />
              <Popconfirm title="确认发布此模板？" onConfirm={() => handlePublish(r.id)}>
                <a style={{ color: '#52c41a' }}>发布</a>
              </Popconfirm>
            </>
          )}
        </Space>
      ),
    },
  ];

  // ==================== 渲染 ====================
  return (
    <div style={{ padding: 24 }}>
      {/* 顶部筛选栏 */}
      <div style={{ marginBottom: 16, display: 'flex', gap: 12, alignItems: 'center', justifyContent: 'space-between' }}>
        <Space>
          <Select
            allowClear placeholder="渠道" style={{ width: 110 }}
            options={CHANNEL_OPTS} value={filterChannel}
            onChange={v => { setFilterChannel(v); setPage(1); }}
          />
          <Select
            allowClear placeholder="状态" style={{ width: 100 }}
            options={[{ label: '草稿', value: 0 }, { label: '已发布', value: 1 }, { label: '已停用', value: 2 }]}
            value={filterStatus}
            onChange={v => { setFilterStatus(v); setPage(1); }}
          />
        </Space>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => openEdit()}>
          新增模板
        </Button>
      </div>

      <Table
        rowKey="id" columns={columns} dataSource={data} loading={loading}
        pagination={{ current: page, total, pageSize: 20, onChange: setPage, showTotal: t => `共 ${t} 条` }}
        size="small" scroll={{ x: 900 }}
      />

      {/* ===== 编辑 Drawer ===== */}
      <Drawer
        title={
          <Space>
            <FileTextOutlined />
            {editing ? `编辑模板 · ${editing.name}` : '新增模板'}
          </Space>
        }
        open={drawerOpen} width={760}
        onClose={() => { setDrawerOpen(false); setEditing(null); }}
        extra={
          <Space>
            {step === 1 && <Button onClick={() => setStep(0)}>上一步</Button>}
            {step === 0 && <Button type="primary" onClick={handleNextStep}>下一步</Button>}
            {step === 1 && <Button type="primary" onClick={handleSave} loading={saving}>保存草稿</Button>}
          </Space>
        }
      >
        <Steps
          current={step} size="small" style={{ marginBottom: 24 }}
          items={[
            { title: '基本信息', icon: <SettingOutlined /> },
            { title: '模板内容', icon: <FileTextOutlined /> },
          ]}
        />

        <Form form={form} layout="vertical">
          {/* ---- Step 0：基本信息 ---- */}
          <div style={{ display: step === 0 ? 'block' : 'none' }}>
            <Row gutter={16}>
              <Col span={24}>
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
                        类型 code：<span style={{ fontFamily: 'monospace', color: '#595959' }}>{m[1]}</span>
                      </div>
                    ) : null;
                  }}
                </Form.Item>
              </Col>
            </Row>
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item name="code" label="模板编码" rules={[{ required: true, message: '请输入编码' }, { pattern: /^[a-zA-Z][a-zA-Z0-9_]{2,49}$/, message: '字母开头，仅含字母/数字/下划线，3-50字符' }]}>
                  <Input placeholder="如：order_shipped" disabled={!!editing} />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="name" label="模板名称" rules={[{ required: true, message: '请输入名称' }]}>
                  <Input placeholder="如：订单发货通知" />
                </Form.Item>
              </Col>
            </Row>
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item name="channel" label="发送渠道" rules={[{ required: true, message: '请选择渠道' }]}>
                  <Select options={CHANNEL_OPTS} placeholder="选择渠道" />
                </Form.Item>
              </Col>
            </Row>
            <Form.Item name="description" label="描述（可选）">
              <Input.TextArea rows={2} placeholder="简要说明此模板的用途" />
            </Form.Item>
          </div>

          {/* ---- Step 1：模板内容 ---- */}
          <div style={{ display: step === 1 ? 'block' : 'none' }}>
            <Alert
              type="info" showIcon style={{ marginBottom: 16 }}
              message={
                <span>
                  使用 <code style={{ background: '#e6f4ff', padding: '1px 4px', borderRadius: 3 }}>{'{{variable.path}}'}</code> 插入变量。
                  {channelWatch === 'sms' ? ' 短信渠道：纯文本，变量值不转义。' : ' HTML 渠道：变量值自动转义 & < > " \'。'}
                </span>
              }
            />
            <Row gutter={16}>
              {/* 左侧编辑区 */}
              <Col span={12}>
                <Form.Item name="titleTemplate" label="标题模板（可选）">
                  <Input placeholder="如：你好 {{user.name}}，订单已发货" />
                </Form.Item>
                <Form.Item name="contentTemplate" label="内容模板" rules={[{ required: true, message: '请输入内容模板' }]}>
                  <Input.TextArea
                    rows={10}
                    placeholder={'支持 {{variable.path}} 占位符\n如：你的订单 {{order.no}} 已发货'}
                    style={{ fontFamily: 'monospace', fontSize: 13 }}
                  />
                </Form.Item>
              </Col>
              {/* 右侧预览区 */}
              <Col span={12}>
                <div style={{ border: '1px solid #f0f0f0', borderRadius: 6, padding: 16, height: '100%', minHeight: 360 }}>
                  <PreviewPanel
                    titleTpl={titleTplWatch}
                    contentTpl={contentTplWatch}
                    channel={channelWatch}
                    templateId={editing?.id}
                  />
                </div>
              </Col>
            </Row>
          </div>
        </Form>
      </Drawer>

      {/* ===== 版本历史 Drawer ===== */}
      <Drawer
        title={<Space><HistoryOutlined />版本历史 · {historyData?.template?.name}</Space>}
        open={historyOpen} width={520}
        onClose={() => setHistoryOpen(false)}
      >
        {historyLoading && <div style={{ textAlign: 'center', padding: 40, color: '#999' }}>加载中...</div>}
        {historyData && (
          <Timeline
            items={(historyData.versions || []).map((v: any) => ({
              color: v.version === historyData.template.currentVersion ? 'blue' : 'gray',
              children: (
                <div style={{ paddingBottom: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Space>
                      <Tag color={v.version === historyData.template.currentVersion ? 'blue' : 'default'}>
                        v{v.version}
                      </Tag>
                      {v.changeNote && <span style={{ fontSize: 12, color: '#595959' }}>{v.changeNote}</span>}
                    </Space>
                    {v.version !== historyData.template.currentVersion && (
                      <Popconfirm
                        title={`确认回滚至 v${v.version}？`}
                        description="当前版本将被备份，回滚后自动发布。"
                        onConfirm={() => handleRollback(v.id)}
                      >
                        <Button size="small" icon={<RollbackOutlined />} loading={rollingBack}>
                          回滚
                        </Button>
                      </Popconfirm>
                    )}
                  </div>
                  <div style={{ fontSize: 12, color: '#8c8c8c', marginTop: 4 }}>
                    {v.publishedAt || v.createdAt}
                    {v.publishedBy && ` · 操作人 #${v.publishedBy}`}
                  </div>
                  {v.titleTemplate && (
                    <div style={{ marginTop: 6, fontSize: 12, background: '#fafafa', padding: '4px 8px', borderRadius: 4 }}>
                      标题：{v.titleTemplate}
                    </div>
                  )}
                  <div style={{ marginTop: 4, fontSize: 12, background: '#fafafa', padding: '4px 8px', borderRadius: 4, maxHeight: 60, overflow: 'hidden' }}>
                    {v.contentTemplate}
                  </div>
                </div>
              ),
            }))}
          />
        )}
        {historyData && (!historyData.versions || historyData.versions.length === 0) && (
          <div style={{ textAlign: 'center', color: '#999', padding: 40 }}>暂无版本历史</div>
        )}
      </Drawer>

      {/* ===== 测试发送 Modal ===== */}
      <Modal
        title={<Space><SendOutlined />测试发送 · {testTarget?.name}</Space>}
        open={testOpen} onCancel={() => setTestOpen(false)}
        onOk={handleTestSend} okText="发送"
      >
        <Form layout="vertical">
          <Form.Item label="接收用户 ID" required>
            <Input
              value={testUserId} onChange={e => setTestUserId(e.target.value)}
              placeholder="输入用户 ID（发送给该用户）"
            />
          </Form.Item>
          <Form.Item label="模板变量（JSON）">
            <Input.TextArea
              rows={6} value={testVarJson}
              onChange={e => setTestVarJson(e.target.value)}
              style={{ fontFamily: 'monospace', fontSize: 12 }}
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};
