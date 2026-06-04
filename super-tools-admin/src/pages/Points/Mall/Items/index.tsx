import React, { useEffect, useState } from 'react';
import { Table, Button, Space, Tag, Card, Select, message } from 'antd';
import { PlusOutlined, ReloadOutlined, EditOutlined } from '@ant-design/icons';
import AuthButton from '@/components/AuthButton';
import { listMallItems, createMallItem, updateMallItem, PointsMallItem } from '@/services/points';
import ItemEditDrawer from './ItemEditDrawer';

/**
 * 积分商城 · 商品管理
 *
 * 后端路由（router.ts §积分体系（管理端）商城商品 + 订单管理）：
 *   GET  /api/admin/points/mall/items       (perm points:mall:list)
 *   POST /api/admin/points/mall/items       (perm points:mall:manage)
 *   PUT  /api/admin/points/mall/items/:id   (perm points:mall:manage)
 *
 * 按钮权限（database/028 §4 type=3）：
 *   points:btn:mall:item:create | edit
 */
const Items: React.FC = () => {
  const [data, setData] = useState<{ list: PointsMallItem[]; total: number }>({ list: [], total: 0 });
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [filters, setFilters] = useState<{ category?: string; status?: 0 | 1 }>({});
  const [editing, setEditing] = useState<Partial<PointsMallItem> | null>(null);
  const [open, setOpen] = useState(false);

  const fetchItems = async () => {
    setLoading(true);
    try {
      const res: any = await listMallItems({ ...filters, page, pageSize });
      if (res?.code === 200) {
        setData({ list: res.data?.list || [], total: res.data?.total || 0 });
      }
    } finally {
      setLoading(false);
    }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    fetchItems();
  }, [page, pageSize, filters]);

  const handleSubmit = async (values: Partial<PointsMallItem>) => {
    if (editing?.id) {
      const res: any = await updateMallItem(editing.id, values);
      if (res?.code === 200) {
        message.success('更新成功');
        setOpen(false);
        fetchItems();
      }
    } else {
      const res: any = await createMallItem(values);
      if (res?.code === 200) {
        message.success('创建成功');
        setOpen(false);
        fetchItems();
      }
    }
  };

  const columns = [
    { title: 'ID', dataIndex: 'id', width: 70 },
    { title: '名称', dataIndex: 'name', width: 200 },
    {
      title: '分类',
      dataIndex: 'category',
      width: 100,
      render: (v: string) => <Tag>{v}</Tag>,
    },
    { title: '所需积分', dataIndex: 'costPoints', width: 100 },
    { title: '所需等级', dataIndex: 'requiredLevel', width: 100 },
    { title: '库存', dataIndex: 'stock', width: 80 },
    {
      title: '状态',
      dataIndex: 'status',
      width: 80,
      render: (v: number) => (v ? <Tag color="green">上架</Tag> : <Tag>下架</Tag>),
    },
    { title: '排序', dataIndex: 'sort', width: 70 },
    {
      title: '操作',
      key: 'op',
      fixed: 'right' as const,
      width: 100,
      render: (_: any, r: PointsMallItem) => (
        <AuthButton permCode="points:btn:mall:item:edit">
          <Button
            size="small"
            icon={<EditOutlined />}
            onClick={() => {
              setEditing(r);
              setOpen(true);
            }}
          >
            编辑
          </Button>
        </AuthButton>
      ),
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <Card>
        <Space style={{ marginBottom: 16 }}>
          <Select
            placeholder="分类"
            allowClear
            style={{ width: 140 }}
            value={filters.category}
            onChange={(v) => {
              setPage(1);
              setFilters({ ...filters, category: v });
            }}
            options={[
              { value: 'coupon', label: '优惠券' },
              { value: 'member_days', label: '会员天数' },
              { value: 'tool_unlock', label: '工具解锁' },
              { value: 'badge', label: '徽章' },
              { value: 'physical', label: '实物商品' },
            ]}
          />
          <Select
            placeholder="状态"
            allowClear
            style={{ width: 100 }}
            value={filters.status}
            onChange={(v) => {
              setPage(1);
              setFilters({ ...filters, status: v });
            }}
            options={[
              { value: 1, label: '上架' },
              { value: 0, label: '下架' },
            ]}
          />
          <Button icon={<ReloadOutlined />} onClick={fetchItems}>
            刷新
          </Button>
          <AuthButton permCode="points:btn:mall:item:create">
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => {
                setEditing(null);
                setOpen(true);
              }}
            >
              新建商品
            </Button>
          </AuthButton>
        </Space>
        <Table
          rowKey="id"
          dataSource={data.list}
          columns={columns}
          loading={loading}
          scroll={{ x: 1100 }}
          pagination={{
            current: page,
            pageSize,
            total: data.total,
            showTotal: (t) => `共 ${t} 条`,
            showSizeChanger: true,
            onChange: (p, ps) => {
              setPage(p);
              setPageSize(ps);
            },
          }}
        />
        <ItemEditDrawer
          open={open}
          initial={editing || undefined}
          onClose={() => setOpen(false)}
          onSubmit={handleSubmit}
        />
      </Card>
    </div>
  );
};

export default Items;
