import React, { useState, useEffect, useCallback } from 'react';
import { PageContainer } from '@ant-design/pro-layout';
import { Card, Button, Space, Drawer, List, Modal, Form, Input, Select, message, Popconfirm, Tag, Empty, Tooltip } from 'antd';
import { PlusOutlined, EditOutlined, SaveOutlined, DeleteOutlined, EyeOutlined, SettingOutlined, ShareAltOutlined, UndoOutlined } from '@ant-design/icons';
import GridLayout from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
import WIDGET_REGISTRY from './widgets/registry';
import type { WidgetDefinition } from './widgets/registry';
import { getLayouts, getLayout, createLayout, updateLayout, deleteLayout, setLayoutDefault, shareLayout } from '@/services/dashboard';

interface WidgetItem {
  i: string;
  x: number; y: number; w: number; h: number;
  minW?: number; minH?: number;
  widgetType: string;
  title: string;
  dataConfig: any;
}

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
  const [loading, setLoading] = useState(false);

  useEffect(() => { fetchLayouts(); }, []);

  const fetchLayouts = async () => {
    setLoading(true);
    try {
      const res = await getLayouts();
      const list = res?.data || [];
      setLayouts(list);
      // 加载默认布局
      const defaultLayout = list.find((l: any) => l.is_default) || list[0];
      if (defaultLayout) loadLayout(defaultLayout.id);
    } finally { setLoading(false); }
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
        widgetType: w.widget_type,
        title: w.title || '',
        dataConfig: w.data_config || {},
      })),
    );
  };

  const handleLayoutChange = useCallback((newLayout: any[]) => {
    setWidgets(prev => prev.map(w => {
      const gridItem = newLayout.find(g => g.i === w.i);
      if (!gridItem) return w;
      return { ...w, x: gridItem.x, y: gridItem.y, w: gridItem.w, h: gridItem.h };
    }));
  }, []);

  const addWidget = (def: WidgetDefinition) => {
    const newWidget: WidgetItem = {
      i: `widget-${Date.now()}`,
      x: 0, y: Infinity, // 放到底部
      ...def.defaultSize,
      widgetType: def.type,
      title: def.name,
      dataConfig: {},
    };
    setWidgets(prev => [...prev, newWidget]);
    setDrawerVisible(false);
  };

  const removeWidget = (id: string) => {
    setWidgets(prev => prev.filter(w => w.i !== id));
  };

  const openConfig = (id: string) => {
    const widget = widgets.find(w => w.i === id);
    if (!widget) return;
    configForm.setFieldsValue({ title: widget.title, widgetType: widget.widgetType });
    setConfigWidgetId(id);
  };

  const saveConfig = () => {
    const values = configForm.getFieldsValue();
    setWidgets(prev => prev.map(w =>
      w.i === configWidgetId ? { ...w, title: values.title, widgetType: values.widgetType } : w,
    ));
    setConfigWidgetId(null);
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

    if (currentLayoutId && currentLayoutName === values.name) {
      await updateLayout(currentLayoutId, payload);
      message.success('保存成功');
    } else {
      const res = await createLayout(payload);
      setCurrentLayoutId(res?.data?.id);
      message.success('创建成功');
    }
    setSaveModalVisible(false);
    setEditing(false);
    fetchLayouts();
  };

  const handleDelete = async (id: number) => {
    await deleteLayout(id);
    message.success('删除成功');
    if (id === currentLayoutId) { setCurrentLayoutId(null); setWidgets([]); }
    fetchLayouts();
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
    fetchLayouts();
  };

  const widgetTypeMap = Object.fromEntries(WIDGET_REGISTRY.map(w => [w.type, w]));

  return (
    <PageContainer
      title="可视化配置"
      subTitle={currentLayoutName || '选择或创建布局'}
      extra={
        <Space>
          <Select
            style={{ width: 200 }}
            placeholder="选择布局"
            value={currentLayoutId}
            onChange={(id) => loadLayout(id)}
          >
            {layouts.map((l: any) => (
              <Select.Option key={l.id} value={l.id}>
                {l.name} {l.is_default ? '(默认)' : ''}
              </Select.Option>
            ))}
          </Select>
          {editing ? (
            <>
              <Button icon={<PlusOutlined />} onClick={() => setDrawerVisible(true)}>添加组件</Button>
              <Button type="primary" icon={<SaveOutlined />} onClick={() => {
                saveForm.setFieldsValue({ name: currentLayoutName, description: '' });
                setSaveModalVisible(true);
              }}>保存</Button>
              <Button icon={<UndoOutlined />} onClick={() => { setEditing(false); if (currentLayoutId) loadLayout(currentLayoutId); }}>取消</Button>
            </>
          ) : (
            <Button type="primary" icon={<EditOutlined />} onClick={() => setEditing(true)}>编辑布局</Button>
          )}
        </Space>
      }
    >
      {/* 布局列表 */}
      {!editing && (
        <Card bordered={false} size="small" style={{ marginBottom: 16 }}>
          <Space wrap>
            {layouts.map((l: any) => (
              <Tag key={l.id} color={l.id === currentLayoutId ? 'blue' : 'default'} style={{ padding: '4px 12px', cursor: 'pointer' }}>
                <span onClick={() => loadLayout(l.id)}>{l.name}</span>
                {l.user_id !== null && (
                  <Space size={4} style={{ marginLeft: 8 }}>
                    <Tooltip title="设为默认"><Button type="link" size="small" onClick={() => { setLayoutDefault(l.id); fetchLayouts(); }}>
                      <EyeOutlined />
                    </Button></Tooltip>
                    <Tooltip title="分享"><Button type="link" size="small" onClick={() => handleShare(l.id)}>
                      <ShareAltOutlined />
                    </Button></Tooltip>
                    <Popconfirm title="确定删除？" onConfirm={() => handleDelete(l.id)}>
                      <Button type="link" size="small" danger><DeleteOutlined /></Button>
                    </Popconfirm>
                  </Space>
                )}
              </Tag>
            ))}
          </Space>
        </Card>
      )}

      {/* 网格画布 */}
      <Card bordered={false}>
        {widgets.length > 0 ? (
          <GridLayout
            className="layout"
            layout={widgets.map(w => ({ i: w.i, x: w.x, y: w.y, w: w.w, h: w.h, minW: w.minW, minH: w.minH }))}
            cols={12}
            rowHeight={80}
            width={1200}
            isDraggable={editing}
            isResizable={editing}
            onLayoutChange={handleLayoutChange}
            draggableHandle=".widget-drag-handle"
          >
            {widgets.map(w => {
              const def = widgetTypeMap[w.widgetType];
              return (
                <div key={w.i} style={{ border: editing ? '2px dashed #1890ff' : '1px solid #f0f0f0', borderRadius: 8, background: '#fff', padding: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <span className="widget-drag-handle" style={{ cursor: editing ? 'grab' : 'default', fontWeight: 600, fontSize: 14 }}>
                      {w.title || def?.name || w.widgetType}
                    </span>
                    {editing && (
                      <Space size={4}>
                        <Button type="text" size="small" icon={<SettingOutlined />} onClick={() => openConfig(w.i)} />
                        <Popconfirm title="删除此组件？" onConfirm={() => removeWidget(w.i)}>
                          <Button type="text" size="small" danger icon={<DeleteOutlined />} />
                        </Popconfirm>
                      </Space>
                    )}
                  </div>
                  <div style={{ color: '#999', fontSize: 12 }}>
                    {def?.description || w.widgetType} ({w.w}×{w.h})
                  </div>
                </div>
              );
            })}
          </GridLayout>
        ) : (
          <Empty description={editing ? '点击"添加组件"开始构建仪表板' : '暂无组件，点击"编辑布局"开始配置'} />
        )}
      </Card>

      {/* 组件面板 Drawer */}
      <Drawer title="添加组件" open={drawerVisible} onClose={() => setDrawerVisible(false)} width={350}>
        <List
          dataSource={WIDGET_REGISTRY}
          renderItem={item => (
            <List.Item
              actions={[<Button type="primary" size="small" onClick={() => addWidget(item)}>添加</Button>]}
            >
              <List.Item.Meta title={item.name} description={item.description} />
            </List.Item>
          )}
        />
      </Drawer>

      {/* 组件配置 Modal */}
      <Modal title="组件配置" open={!!configWidgetId} onOk={saveConfig} onCancel={() => setConfigWidgetId(null)}>
        <Form form={configForm} layout="vertical">
          <Form.Item name="title" label="标题"><Input /></Form.Item>
          <Form.Item name="widgetType" label="类型">
            <Select>
              {WIDGET_REGISTRY.map(w => <Select.Option key={w.type} value={w.type}>{w.name}</Select.Option>)}
            </Select>
          </Form.Item>
        </Form>
      </Modal>

      {/* 保存 Modal */}
      <Modal title="保存布局" open={saveModalVisible} onOk={handleSave} onCancel={() => setSaveModalVisible(false)}>
        <Form form={saveForm} layout="vertical">
          <Form.Item name="name" label="布局名称" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="description" label="描述"><Input.TextArea rows={2} /></Form.Item>
        </Form>
      </Modal>
    </PageContainer>
  );
};

export default DashboardConfig;
