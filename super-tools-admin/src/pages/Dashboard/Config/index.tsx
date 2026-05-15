import React, { useState, useEffect, useCallback } from 'react';
import { PageContainer } from '@ant-design/pro-layout';
import { Card, Button, Space, Drawer, List, Modal, Form, Input, Select, InputNumber,
  message, Popconfirm, Tag, Empty, Tooltip, Row, Col, Alert } from 'antd';
import { PlusOutlined, EditOutlined, SaveOutlined, DeleteOutlined,
  EyeOutlined, SettingOutlined, ShareAltOutlined, UndoOutlined,
  AppstoreOutlined, ThunderboltOutlined } from '@ant-design/icons';
import RGL from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';

const GridLayout = RGL as any;
import WIDGET_REGISTRY from './widgets/registry';
import type { WidgetDefinition } from './widgets/registry';
import WidgetRenderer from './widgets/WidgetRenderer';
import PRESET_TEMPLATES from './presets';
import type { PresetTemplate } from './presets';
import { getLayouts, getLayout, createLayout, updateLayout, deleteLayout, setLayoutDefault, shareLayout } from '@/services/dashboard';

interface WidgetItem {
  i: string;
  x: number; y: number; w: number; h: number;
  minW?: number; minH?: number;
  widgetType: string;
  title: string;
  dataConfig: any;
}

// 指标选项（用于 line_chart / area_chart 的 dataConfig.metric）
const METRIC_OPTIONS = [
  { value: 'user-register', label: '用户注册' },
  { value: 'user-login', label: '用户登录' },
  { value: 'tool-access', label: '工具访问' },
  { value: 'feedback-submit', label: '反馈提交' },
];

const DashboardConfig: React.FC = () => {
  const [layouts, setLayouts] = useState<any[]>([]);
  const [currentLayoutId, setCurrentLayoutId] = useState<number | null>(null);
  const [currentLayoutName, setCurrentLayoutName] = useState('');
  const [widgets, setWidgets] = useState<WidgetItem[]>([]);
  const [editing, setEditing] = useState(false);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [configWidgetId, setConfigWidgetId] = useState<string | null>(null);
  const [configForm] = Form.useForm();
  const [saveModalVisible, setSaveModalVisible] = useState(false);
  const [saveForm] = Form.useForm();
  const [presetModalVisible, setPresetModalVisible] = useState(false);

  useEffect(() => { fetchLayouts(); }, []);

  const fetchLayouts = async () => {
    const res = await getLayouts();
    const list = res?.data || [];
    setLayouts(list);
    if (list.length > 0) {
      const defaultLayout = list.find((l: any) => l.isDefault || l.is_default) || list[0];
      if (defaultLayout) loadLayout(defaultLayout.id);
    } else {
      // 没有任何布局时，自动加载 CEO 预设模板
      applyPreset(PRESET_TEMPLATES[0]);
    }
  };

  const loadLayout = async (id: number) => {
    const res = await getLayout(id);
    if (!res?.data) return;
    const { layout, widgets: dbWidgets } = res.data;
    setCurrentLayoutId(layout.id);
    setCurrentLayoutName(layout.name);
    setWidgets(
      (dbWidgets || []).map((w: any, idx: number) => ({
        i: `widget-${idx}`,
        ...(w.position || { x: 0, y: 0, w: 6, h: 4 }),
        minW: 2, minH: 2,
        widgetType: w.widgetType || w.widget_type,
        title: w.title || '',
        dataConfig: w.dataConfig || w.data_config || {},
      })),
    );
  };

  const applyPreset = (preset: PresetTemplate) => {
    setCurrentLayoutId(null);
    setCurrentLayoutName(preset.name);
    setWidgets(
      preset.widgets.map((w, idx) => ({
        i: `widget-${idx}`,
        ...w.position,
        minW: 2, minH: 2,
        widgetType: w.widgetType,
        title: w.title,
        dataConfig: w.dataConfig,
      })),
    );
    setPresetModalVisible(false);
    setEditing(false);
    message.success(`已应用「${preset.name}」模板，点击"编辑布局"可自定义调整`);
  };

  const handleLayoutChange = useCallback((newLayout: any) => {
    if (!Array.isArray(newLayout)) return;
    setWidgets(prev => prev.map(w => {
      const gridItem = newLayout.find((g: any) => g.i === w.i);
      if (!gridItem) return w;
      return { ...w, x: gridItem.x, y: gridItem.y, w: gridItem.w, h: gridItem.h };
    }));
  }, []);

  const addWidget = (def: WidgetDefinition) => {
    const defaultDataConfig: any = {};
    if (def.type === 'line_chart' || def.type === 'area_chart') {
      defaultDataConfig.metric = 'user-register';
    }
    setWidgets(prev => [...prev, {
      i: `widget-${Date.now()}`,
      x: 0, y: Infinity,
      ...def.defaultSize,
      widgetType: def.type,
      title: def.name,
      dataConfig: defaultDataConfig,
    }]);
    setDrawerVisible(false);
  };

  const removeWidget = (id: string) => {
    setWidgets(prev => prev.filter(w => w.i !== id));
  };

  const openConfig = (id: string) => {
    const widget = widgets.find(w => w.i === id);
    if (!widget) return;
    configForm.setFieldsValue({
      title: widget.title,
      widgetType: widget.widgetType,
      metric: widget.dataConfig?.metric,
      content: widget.dataConfig?.content,
      refreshInterval: widget.dataConfig?.refreshInterval,
    });
    setConfigWidgetId(id);
  };

  const saveConfig = () => {
    const values = configForm.getFieldsValue();
    setWidgets(prev => prev.map(w => {
      if (w.i !== configWidgetId) return w;
      const newDataConfig = { ...w.dataConfig };
      if (values.metric !== undefined) newDataConfig.metric = values.metric;
      if (values.content !== undefined) newDataConfig.content = values.content;
      if (values.refreshInterval !== undefined) newDataConfig.refreshInterval = values.refreshInterval;
      return { ...w, title: values.title, widgetType: values.widgetType, dataConfig: newDataConfig };
    }));
    setConfigWidgetId(null);
    message.success('组件配置已更新');
  };

  const handleSave = async () => {
    const values = await saveForm.validateFields();
    const payload = {
      name: values.name,
      description: values.description,
      layoutConfig: { cols: 12, rowHeight: 80, margin: [16, 16] },
      widgets: widgets.map(w => ({
        widgetType: w.widgetType,
        title: w.title,
        dataConfig: w.dataConfig,
        position: { x: w.x, y: w.y, w: w.w, h: w.h },
      })),
    };

    if (currentLayoutId) {
      await updateLayout(currentLayoutId, payload);
      message.success('保存成功');
    } else {
      const res = await createLayout(payload);
      setCurrentLayoutId(res?.data?.id);
      message.success('看板已保存');
    }
    setSaveModalVisible(false);
    setEditing(false);
    await fetchLayouts();
  };

  const handleDelete = async (id: number) => {
    await deleteLayout(id);
    message.success('删除成功');
    if (id === currentLayoutId) { setCurrentLayoutId(null); setWidgets([]); }
    await fetchLayouts();
  };

  const handleShare = async (id: number) => {
    const res = await shareLayout(id);
    if (res?.data?.shareToken) {
      const url = `${window.location.origin}/dashboard/shared/${res.data.shareToken}`;
      navigator.clipboard?.writeText(url);
      message.success('分享链接已复制到剪贴板');
    } else {
      message.info('已取消分享');
    }
    await fetchLayouts();
  };

  const currentConfigWidget = widgets.find(w => w.i === configWidgetId);
  const widgetTypeMap = Object.fromEntries(WIDGET_REGISTRY.map(w => [w.type, w]));
  const showMetricField = currentConfigWidget && ['line_chart', 'area_chart'].includes(currentConfigWidget.widgetType);
  const showContentField = currentConfigWidget?.widgetType === 'text';

  return (
    <PageContainer
      title="可视化看板"
      subTitle={currentLayoutName || '自定义你的数据看板'}
      extra={
        <Space>
          {/* 布局选择 */}
          {layouts.length > 0 && (
            <Select
              style={{ width: 180 }}
              placeholder="切换看板"
              value={currentLayoutId}
              onChange={(id) => loadLayout(id)}
            >
              {layouts.map((l: any) => (
                <Select.Option key={l.id} value={l.id}>
                  {l.name} {(l.isDefault || l.is_default) ? '⭐' : ''}
                </Select.Option>
              ))}
            </Select>
          )}
          {/* 预设模板 */}
          <Button icon={<ThunderboltOutlined />} onClick={() => setPresetModalVisible(true)}>
            预设模板
          </Button>
          {/* 编辑 / 保存 */}
          {editing ? (
            <>
              <Button icon={<PlusOutlined />} onClick={() => setDrawerVisible(true)}>添加组件</Button>
              <Button type="primary" icon={<SaveOutlined />} onClick={() => {
                saveForm.setFieldsValue({ name: currentLayoutName || '我的看板', description: '' });
                setSaveModalVisible(true);
              }}>保存看板</Button>
              <Button icon={<UndoOutlined />} onClick={() => {
                setEditing(false);
                if (currentLayoutId) loadLayout(currentLayoutId);
              }}>取消</Button>
            </>
          ) : (
            <Button type="primary" icon={<EditOutlined />} onClick={() => setEditing(true)}>编辑布局</Button>
          )}
        </Space>
      }
    >
      {/* 已保存看板管理 */}
      {!editing && layouts.length > 0 && (
        <Card size="small" style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Space wrap size={[8, 8]}>
              {layouts.map((l: any) => (
                <Tag
                  key={l.id}
                  color={l.id === currentLayoutId ? 'blue' : 'default'}
                  style={{ padding: '4px 12px', cursor: 'pointer', fontSize: 13 }}
                  onClick={() => loadLayout(l.id)}
                >
                  {l.name} {(l.isDefault || l.is_default) ? '⭐' : ''}
                </Tag>
              ))}
            </Space>
            {currentLayoutId && (
              <Space size={4}>
                <Tooltip title="设为默认看板">
                  <Button type="text" size="small" icon={<EyeOutlined />}
                    onClick={async () => { await setLayoutDefault(currentLayoutId); await fetchLayouts(); message.success('已设为默认'); }} />
                </Tooltip>
                <Tooltip title="分享">
                  <Button type="text" size="small" icon={<ShareAltOutlined />}
                    onClick={() => handleShare(currentLayoutId)} />
                </Tooltip>
                <Popconfirm title="确定删除此看板？" onConfirm={() => handleDelete(currentLayoutId)}>
                  <Button type="text" size="small" danger icon={<DeleteOutlined />} />
                </Popconfirm>
              </Space>
            )}
          </div>
        </Card>
      )}

      {/* 编辑模式提示 */}
      {editing && (
        <Alert message="编辑模式：拖拽组件调整位置，拖拽边缘调整大小，点击 ⚙ 配置组件参数" type="info" showIcon style={{ marginBottom: 16 }} />
      )}

      {/* 网格画布 */}
      <Card>
        {widgets.length > 0 ? (
          <GridLayout
            className="layout"
            layout={widgets.map(w => ({ i: w.i, x: w.x, y: w.y, w: w.w, h: w.h, minW: w.minW || 2, minH: w.minH || 2 })) as any}
            cols={12}
            rowHeight={80}
            width={1200}
            isDraggable={editing}
            isResizable={editing}
            onLayoutChange={handleLayoutChange as any}
            draggableHandle=".widget-drag-handle"
          >
            {widgets.map(w => {
              const def = widgetTypeMap[w.widgetType];
              return (
                <div key={w.i} style={{
                  border: editing ? '2px dashed #1890ff' : '1px solid #f0f0f0',
                  borderRadius: 8, background: '#fff', padding: 12,
                  display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden',
                  boxShadow: editing ? 'none' : '0 1px 4px rgba(0,0,0,0.04)',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4, flexShrink: 0 }}>
                    <span className="widget-drag-handle" style={{
                      cursor: editing ? 'grab' : 'default',
                      fontWeight: 600, fontSize: 13, color: '#333',
                    }}>
                      {w.title || def?.name || w.widgetType}
                    </span>
                    {editing && (
                      <Space size={2}>
                        <Button type="text" size="small" icon={<SettingOutlined />} onClick={() => openConfig(w.i)} />
                        <Popconfirm title="删除此组件？" onConfirm={() => removeWidget(w.i)}>
                          <Button type="text" size="small" danger icon={<DeleteOutlined />} />
                        </Popconfirm>
                      </Space>
                    )}
                  </div>
                  <div style={{ flex: 1, overflow: 'hidden' }}>
                    {editing ? (
                      <div style={{ color: '#bbb', fontSize: 12, textAlign: 'center', paddingTop: 20 }}>
                        <AppstoreOutlined style={{ fontSize: 24, marginBottom: 8, display: 'block' }} />
                        {def?.name || w.widgetType}
                        {w.dataConfig?.metric && <div style={{ marginTop: 4 }}>指标: {METRIC_OPTIONS.find(m => m.value === w.dataConfig.metric)?.label || w.dataConfig.metric}</div>}
                      </div>
                    ) : (
                      <WidgetRenderer widgetType={w.widgetType} dataConfig={w.dataConfig} />
                    )}
                  </div>
                </div>
              );
            })}
          </GridLayout>
        ) : (
          <Empty
            description="还没有看板内容"
            style={{ padding: '60px 0' }}
          >
            <Space>
              <Button type="primary" icon={<ThunderboltOutlined />} onClick={() => setPresetModalVisible(true)}>
                选择预设模板
              </Button>
              <Button icon={<EditOutlined />} onClick={() => setEditing(true)}>
                从零开始
              </Button>
            </Space>
          </Empty>
        )}
      </Card>

      {/* 预设模板选择 */}
      <Modal
        title="选择预设模板" open={presetModalVisible}
        onCancel={() => setPresetModalVisible(false)} footer={null} width={700}
      >
        <p style={{ color: '#666', marginBottom: 16 }}>选择一套预设模板快速创建看板，应用后可自由编辑调整</p>
        <Row gutter={[16, 16]}>
          {PRESET_TEMPLATES.map(preset => (
            <Col span={8} key={preset.key}>
              <Card
                hoverable
                style={{ textAlign: 'center', cursor: 'pointer' }}
                onClick={() => applyPreset(preset)}
              >
                <div style={{ fontSize: 36, marginBottom: 8 }}>{preset.icon}</div>
                <div style={{ fontWeight: 600, fontSize: 16, marginBottom: 4 }}>{preset.name}</div>
                <div style={{ color: '#999', fontSize: 12 }}>{preset.description}</div>
                <div style={{ marginTop: 8 }}>
                  <Tag>{preset.widgets.length} 个组件</Tag>
                </div>
              </Card>
            </Col>
          ))}
        </Row>
      </Modal>

      {/* 添加组件 Drawer */}
      <Drawer title="添加组件" open={drawerVisible} onClose={() => setDrawerVisible(false)} width={380}>
        <List
          dataSource={WIDGET_REGISTRY}
          renderItem={item => (
            <List.Item actions={[<Button type="primary" size="small" onClick={() => addWidget(item)}>添加</Button>]}>
              <List.Item.Meta
                title={item.name}
                description={item.description}
              />
            </List.Item>
          )}
        />
      </Drawer>

      {/* 组件配置 Modal */}
      <Modal title="组件配置" open={!!configWidgetId} onOk={saveConfig} onCancel={() => setConfigWidgetId(null)}
        destroyOnClose width={500}>
        <Form form={configForm} layout="vertical" preserve={false}>
          <Form.Item name="title" label="标题">
            <Input placeholder="组件标题" />
          </Form.Item>
          <Form.Item name="widgetType" label="组件类型">
            <Select>
              {WIDGET_REGISTRY.map(w => <Select.Option key={w.type} value={w.type}>{w.name}</Select.Option>)}
            </Select>
          </Form.Item>
          {showMetricField && (
            <Form.Item name="metric" label="数据指标">
              <Select placeholder="选择要展示的指标" options={METRIC_OPTIONS} />
            </Form.Item>
          )}
          {showContentField && (
            <Form.Item name="content" label="文本内容">
              <Input.TextArea rows={3} placeholder="输入自定义文本" />
            </Form.Item>
          )}
          <Form.Item name="refreshInterval" label="自动刷新间隔(秒)" extra="0 表示不自动刷新">
            <InputNumber min={0} step={30} style={{ width: '100%' }} placeholder="0" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 保存看板 Modal */}
      <Modal title="保存看板" open={saveModalVisible} onOk={handleSave} onCancel={() => setSaveModalVisible(false)}
        destroyOnClose>
        <Form form={saveForm} layout="vertical" preserve={false}>
          <Form.Item name="name" label="看板名称" rules={[{ required: true, message: '请输入看板名称' }]}>
            <Input placeholder="如: 我的数据看板" />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input.TextArea rows={2} placeholder="简要描述这个看板的用途" />
          </Form.Item>
        </Form>
      </Modal>
    </PageContainer>
  );
};

export default DashboardConfig;
