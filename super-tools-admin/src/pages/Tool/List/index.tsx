import React, { useEffect, useState, useMemo } from 'react';
import {
  Card, Table, Button, Input, Space, Switch, Popconfirm, message, Tag, Select, Form,
} from 'antd';
import { PlusOutlined, ReloadOutlined } from '@ant-design/icons';
import {
  listTools,
  deleteTool,
  updateTool,
  batchPublish,
  listCategories,
  ListToolsQuery,
  LevelCode,
} from '@/services/tool';
import ToolModal from './ToolModal';
import './index.less';

interface Tool {
  id: number;
  code: string;
  name: string;
  description?: string;
  keyword?: string;
  categoryId: number;
  categoryCode: string;
  icon?: string;
  color?: string;
  path: string;
  isFeature: 0 | 1;
  requiredLevelCode: LevelCode;
  requirePaid: 0 | 1;
  status: 0 | 1;
  sort: number;
  createdAt?: string;
}

interface Category {
  id: number;
  name: string;
  code: string;
}

const LEVEL_NAME_MAP: Record<LevelCode, string> = {
  free: '普通用户',
  silver: '银牌会员',
  gold: '金牌会员',
  diamond: '钻石会员',
  black: '黑金会员',
};

const LEVEL_COLOR_MAP: Record<LevelCode, string> = {
  free: 'default',
  silver: 'blue',
  gold: 'gold',
  diamond: 'purple',
  black: '#222',
};

const ToolListPage: React.FC = () => {
  const [data, setData] = useState<{ list: Tool[]; total: number }>({ list: [], total: 0 });
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [filters, setFilters] = useState<ListToolsQuery>({});
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [editing, setEditing] = useState<Tool | null>(null);

  const fetch = async () => {
    setLoading(true);
    try {
      const res: any = await listTools({ page, pageSize, ...filters });
      if (res?.code === 200 && res.data) {
        setData({ list: res.data.list || [], total: res.data.total || 0 });
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    listCategories({ page: 1, pageSize: 100 }).then((res: any) => {
      if (res?.code === 200 && res.data?.list) setCategories(res.data.list);
    });
  }, []);

  useEffect(() => {
    fetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, pageSize, filters]);

  const handleStatusToggle = async (row: Tool, c: boolean) => {
    const res: any = await updateTool(row.id, { status: c ? 1 : 0 });
    if (res?.code === 200) {
      message.success('已更新');
      fetch();
    } else {
      message.error('更新失败');
    }
  };

  const handleDelete = async (id: number) => {
    const res: any = await deleteTool(id);
    if (res?.code === 200) {
      message.success('删除成功');
      fetch();
    } else {
      message.error(res?.message || '删除失败');
    }
  };

  const handleBatchPublish = async (status: 0 | 1) => {
    if (selectedIds.length === 0) return;
    const res: any = await batchPublish(selectedIds, status);
    if (res?.code === 200) {
      message.success(
        `已${status === 1 ? '上架' : '下架'} ${res.data?.affected || selectedIds.length} 个工具`,
      );
      setSelectedIds([]);
      fetch();
    } else {
      message.error(res?.message || '操作失败');
    }
  };

  const columns = useMemo(
    () => [
      { title: 'ID', dataIndex: 'id', width: 70 },
      { title: '编码', dataIndex: 'code', width: 130, render: (v: string) => <Tag>{v}</Tag> },
      { title: '名称', dataIndex: 'name', width: 140 },
      {
        title: '分类',
        dataIndex: 'categoryCode',
        width: 110,
        render: (v: string) => categories.find((c) => c.code === v)?.name || v,
      },
      {
        title: '图标',
        dataIndex: 'icon',
        width: 60,
        render: (v: string, row: Tool) =>
          v ? (
            <img src={v} alt="" style={{ height: 24 }} />
          ) : (
            <span style={{ color: row.color || '#888' }}>●</span>
          ),
      },
      { title: '路径', dataIndex: 'path', width: 140 },
      {
        title: '特色',
        dataIndex: 'isFeature',
        width: 60,
        render: (v: number) => (v === 1 ? <Tag color="gold">特色</Tag> : null),
      },
      {
        title: '最低等级',
        dataIndex: 'requiredLevelCode',
        width: 100,
        render: (v: LevelCode) => <Tag color={LEVEL_COLOR_MAP[v]}>{LEVEL_NAME_MAP[v]}</Tag>,
      },
      {
        title: '需付费',
        dataIndex: 'requirePaid',
        width: 70,
        render: (v: number) => (v === 1 ? <Tag color="purple">VIP</Tag> : null),
      },
      {
        title: '状态',
        dataIndex: 'status',
        width: 80,
        render: (v: number, row: Tool) => (
          <Switch checked={v === 1} onChange={(c) => handleStatusToggle(row, c)} />
        ),
      },
      { title: '排序', dataIndex: 'sort', width: 70 },
      {
        title: '操作',
        width: 120,
        fixed: 'right' as const,
        render: (_: any, row: Tool) => (
          <Space>
            <a onClick={() => { setEditing(row); setModalVisible(true); }}>编辑</a>
            <Popconfirm title="确定删除？" onConfirm={() => handleDelete(row.id)}>
              <a style={{ color: '#ff4d4f' }}>删除</a>
            </Popconfirm>
          </Space>
        ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [categories],
  );

  return (
    <Card title="工具列表管理" className="page-tool-list">
      <Form
        layout="inline"
        style={{ marginBottom: 16 }}
        onFinish={(v) => {
          setPage(1);
          setFilters({
            keyword: v.keyword || undefined,
            categoryCode: v.categoryCode || undefined,
            status: v.status,
            isFeature: v.isFeature,
            requiredLevelCode: v.requiredLevelCode,
            requirePaid: v.requirePaid,
          });
        }}
      >
        <Form.Item name="keyword">
          <Input placeholder="关键字搜索" allowClear style={{ width: 180 }} />
        </Form.Item>
        <Form.Item name="categoryCode">
          <Select
            placeholder="分类"
            allowClear
            style={{ width: 140 }}
            options={categories.map((c) => ({ label: c.name, value: c.code }))}
          />
        </Form.Item>
        <Form.Item name="status">
          <Select
            placeholder="状态"
            allowClear
            style={{ width: 120 }}
            options={[
              { label: '已发布', value: 1 },
              { label: '未发布', value: 0 },
            ]}
          />
        </Form.Item>
        <Form.Item name="isFeature">
          <Select
            placeholder="特色"
            allowClear
            style={{ width: 100 }}
            options={[
              { label: '是', value: 1 },
              { label: '否', value: 0 },
            ]}
          />
        </Form.Item>
        <Form.Item name="requiredLevelCode">
          <Select
            placeholder="最低等级"
            allowClear
            style={{ width: 130 }}
            options={[
              { label: '免费', value: 'free' },
              { label: '银', value: 'silver' },
              { label: '金', value: 'gold' },
              { label: '钻', value: 'diamond' },
              { label: '黑', value: 'black' },
            ]}
          />
        </Form.Item>
        <Form.Item name="requirePaid">
          <Select
            placeholder="需付费"
            allowClear
            style={{ width: 110 }}
            options={[
              { label: '是', value: 1 },
              { label: '否', value: 0 },
            ]}
          />
        </Form.Item>
        <Form.Item>
          <Button type="primary" htmlType="submit">查询</Button>
        </Form.Item>
      </Form>

      <Space style={{ marginBottom: 16 }} wrap>
        <Button icon={<ReloadOutlined />} onClick={fetch}>刷新</Button>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => { setEditing(null); setModalVisible(true); }}
        >
          新建工具
        </Button>
        {selectedIds.length > 0 && (
          <>
            <span style={{ color: '#888' }}>已选 {selectedIds.length} 条</span>
            <Button onClick={() => handleBatchPublish(1)}>批量上架</Button>
            <Button onClick={() => handleBatchPublish(0)}>批量下架</Button>
            <Button onClick={() => setSelectedIds([])}>清空选择</Button>
          </>
        )}
      </Space>

      <Table
        rowKey="id"
        columns={columns}
        dataSource={data.list}
        loading={loading}
        rowSelection={{
          selectedRowKeys: selectedIds,
          onChange: (keys) => setSelectedIds(keys as number[]),
        }}
        pagination={{
          current: page,
          pageSize,
          total: data.total,
          showSizeChanger: true,
          showTotal: (t) => `共 ${t} 条`,
          onChange: (p, ps) => { setPage(p); setPageSize(ps); },
        }}
        scroll={{ x: 1500 }}
      />

      <ToolModal
        visible={modalVisible}
        editing={editing}
        categories={categories}
        onClose={() => setModalVisible(false)}
        onSuccess={fetch}
      />
    </Card>
  );
};

export default ToolListPage;
