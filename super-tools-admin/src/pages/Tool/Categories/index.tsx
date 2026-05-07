import React, { useEffect, useState } from 'react';
import { Card, Table, Button, Input, Space, Switch, Popconfirm, message, Tag } from 'antd';
import { PlusOutlined, ReloadOutlined } from '@ant-design/icons';
import { listCategories, deleteCategory, updateCategory } from '@/services/tool';
import CategoryModal from './CategoryModal';
import './index.less';

interface Category {
  id: number;
  code: string;
  name: string;
  icon?: string;
  description?: string;
  sort: number;
  status: 0 | 1;
  createdAt?: string;
}

const CategoriesPage: React.FC = () => {
  const [data, setData] = useState<{ list: Category[]; total: number }>({ list: [], total: 0 });
  const [loading, setLoading] = useState(false);
  const [keyword, setKeyword] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [modalVisible, setModalVisible] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);

  const fetch = async () => {
    setLoading(true);
    try {
      const res: any = await listCategories({ page, pageSize, keyword: keyword || undefined });
      if (res?.code === 200 && res.data) {
        setData({ list: res.data.list || [], total: res.data.total || 0 });
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, pageSize]);

  const handleStatusToggle = async (row: Category, checked: boolean) => {
    const res: any = await updateCategory(row.id, { status: checked ? 1 : 0 });
    if (res?.code === 200) {
      message.success('已更新');
      fetch();
    } else {
      message.error('更新失败');
    }
  };

  const handleDelete = async (id: number) => {
    const res: any = await deleteCategory(id);
    if (res?.code === 200) {
      message.success('删除成功');
      fetch();
    } else if (res?.code === 100806) {
      message.error('该分类下尚有工具，请先处理');
    } else {
      message.error(res?.message || '删除失败');
    }
  };

  const columns = [
    { title: 'ID', dataIndex: 'id', width: 80 },
    { title: '编码', dataIndex: 'code', width: 140, render: (v: string) => <Tag>{v}</Tag> },
    { title: '名称', dataIndex: 'name' },
    {
      title: '图标',
      dataIndex: 'icon',
      width: 80,
      render: (v: string) => (v ? <img src={v} alt="" style={{ height: 24 }} /> : '-'),
    },
    { title: '描述', dataIndex: 'description', ellipsis: true },
    { title: '排序', dataIndex: 'sort', width: 80 },
    {
      title: '状态',
      dataIndex: 'status',
      width: 80,
      render: (v: number, row: Category) => (
        <Switch checked={v === 1} onChange={(c) => handleStatusToggle(row, c)} />
      ),
    },
    { title: '创建时间', dataIndex: 'createdAt', width: 180 },
    {
      title: '操作',
      width: 140,
      fixed: 'right' as const,
      render: (_: any, row: Category) => (
        <Space>
          <a onClick={() => { setEditing(row); setModalVisible(true); }}>编辑</a>
          <Popconfirm title="确定删除该分类？" onConfirm={() => handleDelete(row.id)}>
            <a style={{ color: '#ff4d4f' }}>删除</a>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <Card title="工具分类管理" className="page-tool-categories">
      <Space style={{ marginBottom: 16 }} wrap>
        <Input.Search
          placeholder="搜索名称/编码"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          onSearch={() => { setPage(1); fetch(); }}
          style={{ width: 240 }}
          allowClear
        />
        <Button icon={<ReloadOutlined />} onClick={fetch}>刷新</Button>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => { setEditing(null); setModalVisible(true); }}
        >
          新建分类
        </Button>
      </Space>

      <Table
        rowKey="id"
        columns={columns}
        dataSource={data.list}
        loading={loading}
        pagination={{
          current: page,
          pageSize,
          total: data.total,
          showSizeChanger: true,
          showTotal: (t) => `共 ${t} 条`,
          onChange: (p, ps) => { setPage(p); setPageSize(ps); },
        }}
        scroll={{ x: 1100 }}
      />

      <CategoryModal
        visible={modalVisible}
        editing={editing}
        onClose={() => setModalVisible(false)}
        onSuccess={fetch}
      />
    </Card>
  );
};

export default CategoriesPage;
