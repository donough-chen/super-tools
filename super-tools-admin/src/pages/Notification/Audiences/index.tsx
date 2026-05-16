import React, { useEffect, useState, useCallback } from 'react';
import { Table, Button, Space, Tag, Drawer, Form, Input, Select, message, Popconfirm, Card, InputNumber } from 'antd';
import { PlusOutlined, DeleteOutlined, PlusCircleOutlined } from '@ant-design/icons';
import { listAudiences, createAudience, updateAudience, deleteAudience, previewAudience, getFieldWhitelist } from '@/services/notification-audience';

// ==================== RuleBuilder 内联组件 ====================

interface FieldOption { field: string; type: string; label: string; ops: string[] }

const OP_LABELS: Record<string, string> = {
  eq: '等于', ne: '不等于', gt: '大于', gte: '大于等于',
  lt: '小于', lte: '小于等于', in: '包含', nin: '不包含', between: '区间',
};

const ConditionRow: React.FC<{
  condition: any; fields: FieldOption[];
  onChange: (c: any) => void; onRemove: () => void;
}> = ({ condition, fields, onChange, onRemove }) => {
  const selectedField = fields.find(f => f.field === condition.field);
  const ops = selectedField?.ops || [];
  return (
    <Space style={{ marginBottom: 8 }} wrap>
      <Select value={condition.field} onChange={v => onChange({ ...condition, field: v, op: '', value: '' })}
        placeholder="选择字段" style={{ width: 160 }} options={fields.map(f => ({ label: f.label, value: f.field }))} />
      <Select value={condition.op} onChange={v => onChange({ ...condition, op: v })}
        placeholder="操作符" style={{ width: 120 }} options={ops.map(o => ({ label: OP_LABELS[o] || o, value: o }))} />
      <Input value={condition.value} onChange={e => onChange({ ...condition, value: e.target.value })}
        placeholder="值" style={{ width: 180 }} />
      <Button icon={<DeleteOutlined />} size="small" danger onClick={onRemove} />
    </Space>
  );
};

const RuleBuilder: React.FC<{
  value?: any; onChange?: (v: any) => void; fields: FieldOption[]; depth?: number;
}> = ({ value, onChange, fields, depth = 0 }) => {
  const group = value || { operator: 'and', conditions: [] };

  const update = (newGroup: any) => onChange?.(newGroup);
  const addCondition = () => update({ ...group, conditions: [...group.conditions, { field: '', op: '', value: '' }] });
  const addGroup = () => update({ ...group, conditions: [...group.conditions, { operator: 'and', conditions: [] }] });
  const removeAt = (i: number) => update({ ...group, conditions: group.conditions.filter((_: any, idx: number) => idx !== i) });
  const updateAt = (i: number, c: any) => update({ ...group, conditions: group.conditions.map((x: any, idx: number) => idx === i ? c : x) });

  return (
    <Card size="small" style={{ marginBottom: 8, borderColor: depth > 0 ? '#d9d9d9' : '#1890ff' }}
      title={<Select value={group.operator} onChange={v => update({ ...group, operator: v })} size="small"
        options={[{ label: '且 (AND)', value: 'and' }, { label: '或 (OR)', value: 'or' }]} style={{ width: 120 }} />}
      extra={<Space>
        <Button size="small" icon={<PlusOutlined />} onClick={addCondition}>条件</Button>
        {depth < 2 && <Button size="small" icon={<PlusCircleOutlined />} onClick={addGroup}>子组</Button>}
      </Space>}>
      {group.conditions.map((cond: any, i: number) =>
        'operator' in cond && 'conditions' in cond
          ? <RuleBuilder key={i} value={cond} onChange={c => updateAt(i, c)} fields={fields} depth={depth + 1} />
          : <ConditionRow key={i} condition={cond} fields={fields} onChange={c => updateAt(i, c)} onRemove={() => removeAt(i)} />
      )}
      {group.conditions.length === 0 && <div style={{ color: '#999', fontSize: 12 }}>点击"条件"添加筛选规则</div>}
    </Card>
  );
};

// ==================== 主页面 ====================

export default () => {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [fields, setFields] = useState<FieldOption[]>([]);
  const [rules, setRules] = useState<any>({ operator: 'and', conditions: [] });
  const [previewResult, setPreviewResult] = useState<any>(null);
  const [form] = Form.useForm();

  const fetch = async () => {
    setLoading(true);
    try {
      const res = await listAudiences({ page, pageSize: 20 });
      if (res?.code === 200) { setData(res.data?.list || []); setTotal(res.data?.total || 0); }
    } finally { setLoading(false); }
  };

  const fetchFields = useCallback(async () => {
    const res = await getFieldWhitelist();
    if (res?.code === 200) setFields(res.data || []);
  }, []);

  useEffect(() => { fetch(); }, [page]);
  useEffect(() => { fetchFields(); }, [fetchFields]);

  const handleSave = async () => {
    const values = await form.validateFields();
    const payload = { ...values, dynamicRules: values.audienceType === 'dynamic' ? rules : null };
    if (editing) {
      await updateAudience(editing.id, payload);
      message.success('更新成功');
    } else {
      await createAudience(payload);
      message.success('创建成功');
    }
    setDrawerOpen(false); form.resetFields(); setEditing(null); fetch();
  };

  const handlePreview = async () => {
    const res = await previewAudience(rules);
    if (res?.code === 200) setPreviewResult(res.data);
  };

  const handleDelete = async (id: number) => { await deleteAudience(id); message.success('删除成功'); fetch(); };

  const columns = [
    { title: 'ID', dataIndex: 'id', width: 50 },
    { title: '名称', dataIndex: 'name', width: 160 },
    { title: '类型', dataIndex: 'audienceType', width: 80, render: (v: string) => <Tag>{v}</Tag> },
    { title: '缓存人数', dataIndex: 'cachedCount', width: 80, render: (v: number) => v ?? '-' },
    { title: '创建时间', dataIndex: 'createdAt', width: 170 },
    {
      title: '操作', width: 120,
      render: (_: any, r: any) => (
        <Space size="small">
          <a onClick={() => { setEditing(r); form.setFieldsValue(r); setRules(r.dynamicRules || { operator: 'and', conditions: [] }); setDrawerOpen(true); }}>编辑</a>
          <Popconfirm title="确认删除？" onConfirm={() => handleDelete(r.id)}><a style={{ color: '#ff4d4f' }}>删除</a></Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
        <h3>受众分组</h3>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => {
          setEditing(null); form.resetFields(); setRules({ operator: 'and', conditions: [] }); setPreviewResult(null); setDrawerOpen(true);
        }}>新增</Button>
      </div>
      <Table rowKey="id" columns={columns} dataSource={data} loading={loading}
        pagination={{ current: page, total, pageSize: 20, onChange: setPage }} size="small" />

      <Drawer title={editing ? '编辑受众' : '新增受众'} open={drawerOpen} width={640}
        onClose={() => setDrawerOpen(false)}
        extra={<Button type="primary" onClick={handleSave}>保存</Button>}>
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="名称" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="audienceType" label="类型" rules={[{ required: true }]} initialValue="dynamic">
            <Select options={[{ label: '全部', value: 'all' }, { label: '静态', value: 'static' }, { label: '动态', value: 'dynamic' }]} />
          </Form.Item>
          <Form.Item name="description" label="描述"><Input.TextArea rows={2} /></Form.Item>
        </Form>

        <h4>规则编辑器</h4>
        <RuleBuilder value={rules} onChange={setRules} fields={fields} />

        <div style={{ marginTop: 16 }}>
          <Button onClick={handlePreview}>预览受众</Button>
          {previewResult && (
            <div style={{ marginTop: 8, padding: 12, background: '#f5f5f5', borderRadius: 4 }}>
              <strong>匹配用户数：{previewResult.total}</strong>
              {previewResult.userIds?.length > 0 && (
                <div style={{ marginTop: 4, fontSize: 12, color: '#666' }}>
                  前 {previewResult.userIds.length} 个 ID：{previewResult.userIds.join(', ')}
                </div>
              )}
            </div>
          )}
        </div>
      </Drawer>
    </div>
  );
};
