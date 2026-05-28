import React, { useEffect, useState } from 'react';
import { Table, Button, Space, Tag, message, Popconfirm, Select, Card } from 'antd';
import { PlusOutlined, ReloadOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import AuthButton from '@/components/AuthButton';
import { listTasks, createTask, updateTask, deleteTask, PointsTask } from '@/services/points';
import TaskEditModal from './TaskEditModal';

/**
 * 积分管理 · 任务管理
 *
 * 后端路由（router.ts §积分体系（管理端）任务管理）：
 *   GET    /api/admin/points/tasks       (perm points:task:list)
 *   POST   /api/admin/points/tasks       (perm points:task:create)
 *   PUT    /api/admin/points/tasks/:id   (perm points:task:update)
 *   DELETE /api/admin/points/tasks/:id   (perm points:task:delete)
 *
 * 按钮权限（database/028 §4 type=3）：
 *   points:btn:task:create | edit | delete
 */
const Tasks: React.FC = () => {
  const [data, setData] = useState<{ list: PointsTask[]; total: number }>({ list: [], total: 0 });
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [filters, setFilters] = useState<{ category?: string; status?: 0 | 1 }>({});
  const [editing, setEditing] = useState<Partial<PointsTask> | null>(null);
  const [open, setOpen] = useState(false);

  const fetchTasks = async () => {
    setLoading(true);
    try {
      const res: any = await listTasks({ ...filters, page, pageSize });
      if (res?.code === 200) {
        setData({ list: res.data?.list || [], total: res.data?.total || 0 });
      }
    } finally {
      setLoading(false);
    }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    fetchTasks();
  }, [page, pageSize, filters]);

  const handleSubmit = async (values: Partial<PointsTask>) => {
    if (editing?.id) {
      const res: any = await updateTask(editing.id, values);
      if (res?.code === 200) {
        message.success('更新成功');
        setOpen(false);
        fetchTasks();
      }
    } else {
      const res: any = await createTask(values);
      if (res?.code === 200) {
        message.success('创建成功');
        setOpen(false);
        fetchTasks();
      }
    }
  };

  const handleDelete = async (id: number) => {
    const res: any = await deleteTask(id);
    if (res?.code === 200) {
      message.success('删除成功');
      fetchTasks();
    }
  };

  const columns = [
    { title: 'ID', dataIndex: 'id', width: 70 },
    { title: 'Code', dataIndex: 'code', width: 160 },
    { title: '名称', dataIndex: 'name', width: 160 },
    {
      title: '分类',
      dataIndex: 'category',
      width: 100,
      render: (v: string) => <Tag>{v}</Tag>,
    },
    { title: '触发事件', dataIndex: 'triggerEvent', width: 160 },
    { title: '奖励积分', dataIndex: 'rewardPoints', width: 100 },
    { title: '奖励成长值', dataIndex: 'rewardGrowth', width: 100 },
    { title: '重置周期', dataIndex: 'resetCycle', width: 100 },
    {
      title: '状态',
      dataIndex: 'status',
      width: 80,
      render: (v: number) => (v ? <Tag color="green">启用</Tag> : <Tag>禁用</Tag>),
    },
    { title: '排序', dataIndex: 'sort', width: 70 },
    {
      title: '操作',
      key: 'op',
      fixed: 'right' as const,
      width: 180,
      render: (_: any, r: PointsTask) => (
        <Space>
          <AuthButton permCode="points:btn:task:edit">
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
          <AuthButton permCode="points:btn:task:delete">
            <Popconfirm title="确认删除？" onConfirm={() => handleDelete(r.id)}>
              <Button size="small" danger icon={<DeleteOutlined />}>
                删除
              </Button>
            </Popconfirm>
          </AuthButton>
        </Space>
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
              { value: 'newbie', label: '新手' },
              { value: 'daily', label: '日常' },
              { value: 'achievement', label: '成就' },
              { value: 'invite', label: '邀请' },
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
              { value: 1, label: '启用' },
              { value: 0, label: '禁用' },
            ]}
          />
          <Button icon={<ReloadOutlined />} onClick={fetchTasks}>
            刷新
          </Button>
          <AuthButton permCode="points:btn:task:create">
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => {
                setEditing(null);
                setOpen(true);
              }}
            >
              新建任务
            </Button>
          </AuthButton>
        </Space>

        <Table
          rowKey="id"
          dataSource={data.list}
          columns={columns}
          loading={loading}
          scroll={{ x: 1300 }}
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

        <TaskEditModal
          open={open}
          initial={editing || undefined}
          onCancel={() => setOpen(false)}
          onOk={handleSubmit}
        />
      </Card>
    </div>
  );
};

export default Tasks;
