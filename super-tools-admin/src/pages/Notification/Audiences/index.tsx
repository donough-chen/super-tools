import React, { useEffect, useState, useCallback } from 'react';
import {
  Table, Button, Space, Tag, Drawer, Form, Input, Select,
  message, Popconfirm, Card, Steps, Tabs, Alert, Divider, Spin,
} from 'antd';
import {
  PlusOutlined, DeleteOutlined, PlusCircleOutlined,
  TeamOutlined, FilterOutlined, EyeOutlined,
} from '@ant-design/icons';
import {
  listAudiences, createAudience, updateAudience, deleteAudience,
  previewAudience, getFieldWhitelist,
} from '@/services/notification-audience';

// ==================== 类型 ====================

interface FieldOption { field: string; type: string; label: string; ops: string[] }

const OP_LABELS: Record<string, string> = {
  eq: '等于', ne: '不等于', gt: '大于', gte: '大于等于',
  lt: '小于', lte: '小于等于', in: '包含', nin: '不包含', between: '区间',
};

const AUDIENCE_TYPE_CONFIG: Record<string, { label: string; color: string; desc: string }> = {
  all:     { label: '全部用户', color: 'blue',   desc: '所有 status=1 的活跃用户' },
  static:  { label: '静态列表', color: 'green',  desc: '指定用户 ID 列表' },
  dynamic: { label: '动态规则', color: 'orange', desc: '按条件实时筛选' },
};

// ==================== 条件行 ====================

const ConditionRow: React.FC<{
  condition: any; fields: FieldOption[];
  onChange: (c: any) => void; onRemove: () => void;
}> = ({ condition, fields, onChange, onRemove }) => {
  const selectedField = fields.find(f => f.field === condition.field);
  const ops = selectedField?.ops || [];
  const isArray = ['in', 'nin'].includes(condition.op);
  const isBetween = condition.op === 'between';

  return (
    <div style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'flex-start', flexWrap: 'wrap' }}>
      <Select
        value={condition.field || undefined}
        onChange={v => onChange({ ...condition, field: v, op: '', value: '' })}
        placeholder="选择字段" style={{ width: 150 }}
        options={fields.map(f => ({ label: f.label, value: f.field }))}
      />
      <Select
        value={condition.op || undefined}
        onChange={v => onChange({ ...condition, op: v, value: '' })}
        placeholder="操作符" style={{ width: 110 }}
        options={ops.map(o => ({ label: OP_LABELS[o] || o, value: o }))}
        disabled={!condition.field}
      />
      {isBetween ? (
        <Space.Compact>
          <Input
            value={Array.isArray(condition.value) ? condition.value[0] : ''}
            onChange={e => onChange({ ...condition, value: [e.target.value, Array.isArray(condition.value) ? condition.value[1] : ''] })}
            placeholder="最小值" style={{ width: 90 }}
          />
          <Input
            value={Array.isArray(condition.value) ? condition.value[1] : ''}
            onChange={e => onChange({ ...condition, value: [Array.isArray(condition.value) ? condition.value[0] : '', e.target.value] })}
            placeholder="最大值" style={{ width: 90 }}
          />
        </Space.Compact>
      ) : (
        <Input
          value={condition.value}
          onChange={e => onChange({ ...condition, value: e.target.value })}
          placeholder={isArray ? '逗号分隔多个值' : (selectedField?.type === 'date' ? '如 P30D 或 2026-01-01' : '值')}
          style={{ width: 180 }}
        />
      )}
      {selectedField?.type === 'date' && (
        <span style={{ fontSize: 11, color: '#8c8c8c', alignSelf: 'center' }}>
          支持相对时间：P7D / P30D / P24H
        </span>
      )}
      <Button icon={<DeleteOutlined />} size="small" danger onClick={onRemove} />
    </div>
  );
};

// ==================== 规则构建器 ====================

const RuleBuilder: React.FC<{
  value?: any; onChange?: (v: any) => void; fields: FieldOption[]; depth?: number;
}> = ({ value, onChange, fields, depth = 0 }) => {
  const group = value || { operator: 'and', conditions: [] };
  const update = (g: any) => onChange?.(g);
  const addCondition = () => update({ ...group, conditions: [...group.conditions, { field: '', op: '', value: '' }] });
  const addGroup = () => update({ ...group, conditions: [...group.conditions, { operator: 'and', conditions: [] }] });
  const removeAt = (i: number) => update({ ...group, conditions: group.conditions.filter((_: any, idx: number) => idx !== i) });
  const updateAt = (i: number, c: any) => update({ ...group, conditions: group.conditions.map((x: any, idx: number) => idx === i ? c : x) });

  const borderColor = depth === 0 ? '#1677ff' : depth === 1 ? '#fa8c16' : '#d9d9d9';

  return (
    <Card
      size="small" style={{ marginBottom: 8, borderColor, borderWidth: 1.5 }}
      title={
        <Space>
          <Select
            value={group.operator}
            onChange={v => update({ ...group, operator: v })}
            size="small"
            options={[{ label: '且 (AND)', value: 'and' }, { label: '或 (OR)', value: 'or' }]}
            style={{ width: 110 }}
          />
          <span style={{ fontSize: 11, color: '#8c8c8c' }}>
            {depth === 0 ? '根条件组' : `嵌套组（第 ${depth + 1} 层）`}
          </span>
        </Space>
      }
      extra={
        <Space>
          <Button size="small" icon={<PlusOutlined />} onClick={addCondition}>添加条件</Button>
          {depth < 2 && (
            <Button size="small" icon={<PlusCircleOutlined />} onClick={addGroup}>嵌套子组</Button>
          )}
        </Space>
      }
    >
      {group.conditions.map((cond: any, i: number) =>
        'operator' in cond && 'conditions' in cond
          ? <RuleBuilder key={i} value={cond} onChange={c => updateAt(i, c)} fields={fields} depth={depth + 1} />
          : <ConditionRow key={i} condition={cond} fields={fields} onChange={c => updateAt(i, c)} onRemove={() => removeAt(i)} />
      )}
      {group.conditions.length === 0 && (
        <div style={{ color: '#bfbfbf', fontSize: 12, padding: '8px 0' }}>
          点击"添加条件"开始配置筛选规则
        </div>
      )}
    </Card>
  );
};

// ==================== 预览面板 ====================

const PreviewPanel: React.FC<{ rules: any; onPreview: () => void; result: any; loading: boolean }> = ({
  rules, onPreview, result, loading,
}) => {
  const condCount = (g: any): number => {
    if (!g?.conditions) return 0;
    return g.conditions.reduce((acc: number, c: any) => acc + ('conditions' in c ? condCount(c) : 1), 0);
  };

  return (
    <div style={{ border: '1px solid #f0f0f0', borderRadius: 8, padding: 16, height: '100%', minHeight: 200 }}>
      <div style={{ fontWeight: 600, marginBottom: 12, fontSize: 13 }}>
        <EyeOutlined style={{ marginRight: 6 }} />受众预估
      </div>
      <div style={{ fontSize: 12, color: '#8c8c8c', marginBottom: 12 }}>
        当前规则包含 <strong>{condCount(rules)}</strong> 个条件
      </div>
      <Button
        type="primary" ghost size="small" onClick={onPreview}
        loading={loading} icon={<TeamOutlined />}
        style={{ marginBottom: 12 }}
      >
        预估匹配人数
      </Button>
      {result && (
        <div>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#1677ff', marginBottom: 4 }}>
            {result.total?.toLocaleString()} 人
          </div>
          {result.userIds?.length > 0 && (
            <div style={{ fontSize: 11, color: '#8c8c8c', lineHeight: 1.8 }}>
              样本 ID（前 {result.userIds.length} 个）：
              <br />
              {result.userIds.slice(0, 20).join(', ')}
              {result.userIds.length > 20 && ' ...'}
            </div>
          )}
        </div>
      )}
      {!result && !loading && (
        <div style={{ color: '#bfbfbf', fontSize: 12 }}>点击按钮预估匹配人数</div>
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
  const [activeTab, setActiveTab] = useState('');

  // 编辑 Drawer
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [step, setStep] = useState(0);
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);

  // 规则 & 预览
  const [rules, setRules] = useState<any>({ operator: 'and', conditions: [] });
  const [previewResult, setPreviewResult] = useState<any>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [fields, setFields] = useState<FieldOption[]>([]);

  const audienceTypeWatch = Form.useWatch('audienceType', form);

  const fetchList = useCallback(async () => {
    setLoading(true);
    try {
      const params: any = { page, pageSize: 20 };
      if (activeTab !== '') params.audienceType = activeTab;
      const res = await listAudiences(params);
      if (res?.code === 200) { setData(res.data?.list || []); setTotal(res.data?.total || 0); }
    } finally { setLoading(false); }
  }, [page, activeTab]);

  const fetchFields = useCallback(async () => {
    const res = await getFieldWhitelist();
    if (res?.code === 200) setFields(res.data || []);
  }, []);

  useEffect(() => { fetchList(); }, [fetchList]);
  useEffect(() => { fetchFields(); }, [fetchFields]);

  // ---- 打开编辑 ----
  const openEdit = (record?: any) => {
    setEditing(record || null);
    setStep(0);
    setPreviewResult(null);
    if (record) {
      form.setFieldsValue(record);
      setRules(record.dynamicRules || { operator: 'and', conditions: [] });
    } else {
      form.resetFields();
      setRules({ operator: 'and', conditions: [] });
    }
    setDrawerOpen(true);
  };

  // ---- 保存 ----
  const handleSave = async () => {
    try { await form.validateFields(); } catch { return; }
    const values = form.getFieldsValue(true);
    const payload = {
      ...values,
      dynamicRules: values.audienceType === 'dynamic' ? rules : null,
    };
    setSaving(true);
    try {
      if (editing) {
        await updateAudience(editing.id, payload);
        message.success('更新成功');
      } else {
        await createAudience(payload);
        message.success('创建成功');
      }
      setDrawerOpen(false);
      fetchList();
    } finally { setSaving(false); }
  };

  // ---- 预览 ----
  const handlePreview = async () => {
    setPreviewLoading(true);
    try {
      const res = await previewAudience(rules);
      if (res?.code === 200) setPreviewResult(res.data);
    } finally { setPreviewLoading(false); }
  };

  // ---- 删除 ----
  const handleDelete = async (id: number) => {
    await deleteAudience(id);
    message.success('删除成功');
    fetchList();
  };

  // ---- Step 校验 ----
  const handleNextStep = async () => {
    try {
      await form.validateFields(['name', 'audienceType']);
      setStep(1);
    } catch { }
  };

  // ==================== 表格列 ====================
  const columns = [
    { title: 'ID', dataIndex: 'id', width: 50 },
    {
      title: '名称 / 描述', width: 200,
      render: (_: any, r: any) => (
        <div>
          <div style={{ fontWeight: 500 }}>{r.name}</div>
          {r.description && <div style={{ fontSize: 12, color: '#8c8c8c' }}>{r.description}</div>}
        </div>
      ),
    },
    {
      title: '类型', dataIndex: 'audienceType', width: 100,
      render: (v: string) => {
        const c = AUDIENCE_TYPE_CONFIG[v] || { label: v, color: 'default' };
        return <Tag color={c.color}>{c.label}</Tag>;
      },
    },
    { 
      title: '缓存人数', dataIndex: 'cachedCount', width: 90,
      render: (v: number) => v != null ? <span style={{ fontWeight: 600 }}>{v}</span> : '-',
    },
    {
      title: '创建时间', dataIndex: 'created_at', width: 160,
      render: (v: string) => v ? new Date(v).toLocaleString('zh-CN') : '-' ,
    },
    {
      title: '操作', width: 120,
      render: (_: any, r: any) => (
        <Space size={4}>
          <a onClick={() => openEdit(r)}>编辑</a>
          <Divider type="vertical" />
          <Popconfirm title="确认删除此受众分组？" onConfirm={() => handleDelete(r.id)}>
            <a style={{ color: '#ff4d4f' }}>删除</a>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  // ==================== 渲染 ====================
  return (
    <div style={{ padding: 24 }}>
      {/* 类型 Tabs + 新建按钮 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <Tabs
          activeKey={activeTab} onChange={k => { setActiveTab(k); setPage(1); }} size="small"
          items={[
            { key: '', label: '全部' },
            { key: 'dynamic', label: '动态规则' },
            { key: 'static', label: '静态列表' },
            { key: 'all', label: '全部用户' },
          ]}
          style={{ marginBottom: 0 }}
        />
        <Button type="primary" icon={<PlusOutlined />} onClick={() => openEdit()}>
          新增受众
        </Button>
      </div>

      <Table
        rowKey="id" columns={columns} dataSource={data} loading={loading}
        pagination={{ current: page, total, pageSize: 20, onChange: setPage, showTotal: t => `共 ${t} 条` }}
        size="small"
      />

      {/* ===== 编辑 Drawer ===== */}
      <Drawer
        title={
          <Space>
            <FilterOutlined />
            {editing ? `编辑受众 · ${editing.name}` : '新增受众分组'}
          </Space>
        }
        open={drawerOpen} width={740}
        onClose={() => setDrawerOpen(false)}
        extra={
          <Space>
            {step === 1 && <Button onClick={() => setStep(0)}>上一步</Button>}
            {step === 0 && audienceTypeWatch !== 'dynamic' && (
              <Button type="primary" onClick={handleSave} loading={saving}>保存</Button>
            )}
            {step === 0 && audienceTypeWatch === 'dynamic' && (
              <Button type="primary" onClick={handleNextStep}>下一步：配置规则</Button>
            )}
            {step === 1 && (
              <Button type="primary" onClick={handleSave} loading={saving}>保存</Button>
            )}
          </Space>
        }
      >
        {/* 仅 dynamic 类型显示 Steps */}
        {audienceTypeWatch === 'dynamic' && (
          <Steps
            current={step} size="small" style={{ marginBottom: 24 }}
            items={[
              { title: '基本信息' },
              { title: '规则配置' },
            ]}
          />
        )}

        <Form form={form} layout="vertical">
          {/* ---- Step 0：基本信息 ---- */}
          <div style={{ display: step === 0 ? 'block' : 'none' }}>
            <Form.Item name="name" label="受众名称" rules={[{ required: true, message: '请输入名称' }]}>
              <Input placeholder="如：高价值付费用户" />
            </Form.Item>
            <Form.Item name="audienceType" label="受众类型" rules={[{ required: true }]} initialValue="dynamic">
              <Select
                options={[
                  { label: '全部用户（所有活跃用户）', value: 'all' },
                  { label: '静态列表（指定用户 ID）', value: 'static' },
                  { label: '动态规则（条件筛选）', value: 'dynamic' },
                ]}
              />
            </Form.Item>

            {/* 类型说明 */}
            {audienceTypeWatch && AUDIENCE_TYPE_CONFIG[audienceTypeWatch] && (
              <Alert
                type="info" showIcon style={{ marginBottom: 16 }}
                message={AUDIENCE_TYPE_CONFIG[audienceTypeWatch].desc}
              />
            )}

            {/* 静态列表：用户 ID 输入 */}
            {audienceTypeWatch === 'static' && (
              <Form.Item
                name="staticUserIds"
                label="用户 ID 列表"
                extra="支持逗号分隔或换行分隔，系统自动过滤无效 ID"
              >
                <Input.TextArea
                  rows={5}
                  placeholder={'1,2,3,101\n或每行一个 ID'}
                />
              </Form.Item>
            )}

            <Form.Item name="description" label="描述（可选）">
              <Input.TextArea rows={2} placeholder="简要说明此受众分组的用途" />
            </Form.Item>
          </div>

          {/* ---- Step 1：规则配置（仅 dynamic） ---- */}
          <div style={{ display: step === 1 ? 'block' : 'none' }}>
            <div style={{ display: 'flex', gap: 16 }}>
              {/* 左侧：规则编辑器 */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, marginBottom: 12, fontSize: 13 }}>
                  <FilterOutlined style={{ marginRight: 6 }} />筛选规则
                  <span style={{ fontWeight: 400, fontSize: 12, color: '#8c8c8c', marginLeft: 8 }}>
                    最多 3 层嵌套
                  </span>
                </div>
                <RuleBuilder value={rules} onChange={v => { setRules(v); setPreviewResult(null); }} fields={fields} />
              </div>

              {/* 右侧：预览面板 */}
              <div style={{ width: 200, flexShrink: 0 }}>
                <PreviewPanel
                  rules={rules}
                  onPreview={handlePreview}
                  result={previewResult}
                  loading={previewLoading}
                />
              </div>
            </div>

            {/* 字段说明 */}
            <div style={{ marginTop: 16, padding: 12, background: '#fafafa', borderRadius: 6 }}>
              <div style={{ fontSize: 12, color: '#8c8c8c', marginBottom: 6 }}>可用字段</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {fields.map(f => (
                  <Tag key={f.field} style={{ fontFamily: 'monospace', fontSize: 11 }}>
                    {f.label}（{f.field}）
                  </Tag>
                ))}
              </div>
            </div>
          </div>
        </Form>
      </Drawer>
    </div>
  );
};
