import React, { useEffect, useMemo, useState } from 'react';
import {
  Card, Table, Button, Input, Space, Switch, Popconfirm, message,
  Tag, Tooltip, Form, Select, DatePicker, Avatar,
} from 'antd';
import { PlusOutlined, ReloadOutlined } from '@ant-design/icons';
import AuthButton from '@/components/AuthButton';
import {
  listUsers, deleteUser, changeUserStatus,
  UserListQuery, User,
} from '@/services/user';
import { REGISTER_SOURCE_LABELS, REGISTER_SOURCE_OPTIONS, isSelf } from '@/utils/userType';
import { formatDateTime } from '@/utils/format';
import { getCurrentUser } from '@/utils/authority';
import UserModal from './UserModal';
import ResetPwdModal from './ResetPwdModal';
import DetailDrawer from './DetailDrawer';
import './index.less';

const { RangePicker } = DatePicker;

const UsersPage: React.FC = () => {
  const [data, setData] = useState<{ list: User[]; total: number }>({ list: [], total: 0 });
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [filters, setFilters] = useState<UserListQuery>({});

  const [editing, setEditing] = useState<User | null>(null);
  const [editVisible, setEditVisible] = useState(false);

  const [resetTarget, setResetTarget] = useState<User | null>(null);
  const [resetVisible, setResetVisible] = useState(false);

  const [detailTarget, setDetailTarget] = useState<User | null>(null);
  const [detailVisible, setDetailVisible] = useState(false);

  // 当前登录 user id（用于自身保护）
  const currentUserId: number | undefined = getCurrentUser()?.id;

  const fetch = async () => {
    setLoading(true);
    try {
      const res: any = await listUsers({ page, pageSize, ...filters });
      if (res?.code === 200 && res.data) {
        setData({ list: res.data.list || [], total: res.data.total || 0 });
      }
    } finally { setLoading(false); }
  };

  useEffect(() => {
    fetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, pageSize, filters]);

  const handleStatus = async (row: User, c: boolean) => {
    if (isSelf(row.id, currentUserId)) {
      message.warning('不能切换自己的状态');
      return;
    }
    const res: any = await changeUserStatus(row.id, c ? 1 : 0);
    if (res?.code === 200) {
      message.success('已更新');
      fetch();
    } else {
      message.error(res?.message || '更新失败');
    }
  };

  const handleDelete = async (id: number) => {
    if (isSelf(id, currentUserId)) {
      message.warning('不能删除自己');
      return;
    }
    const res: any = await deleteUser(id);
    if (res?.code === 200) {
      message.success('删除成功');
      fetch();
    } else {
      message.error(res?.message || '删除失败');
    }
  };

  const columns = useMemo(() => [
    { title: 'ID', dataIndex: 'id', width: 70 },
    {
      title: '头像', dataIndex: 'avatar', width: 70,
      render: (v: string, row: User) =>
        <Avatar src={v} size="small">{!v && row.username?.[0]?.toUpperCase()}</Avatar>,
    },
    { title: '用户名', dataIndex: 'username', width: 130 },
    { title: '昵称', dataIndex: 'nickname', width: 130, render: (v: string) => v || '-' },
    { title: '邮箱', dataIndex: 'email', width: 180, render: (v: string) => v || '-' },
    { title: '手机', dataIndex: 'phone', width: 130, render: (v: string) => v || '-' },
    {
      title: '注册来源', dataIndex: 'registerSource', width: 120,
      render: (v: string) =>
        <Tag>{REGISTER_SOURCE_LABELS[v] || v || '-'}</Tag>,
    },
    {
      title: '状态', dataIndex: 'status', width: 90,
      render: (v: number, row: User) => (
        <Tooltip title={isSelf(row.id, currentUserId) ? '不能切换自己的状态' : ''}>
          <Switch
            checked={v === 1}
            disabled={isSelf(row.id, currentUserId)}
            onChange={(c) => handleStatus(row, c)}
          />
        </Tooltip>
      ),
    },
    {
      title: '注册时间', dataIndex: 'createdAt', width: 160,
      render: (v: string) => formatDateTime(v),
    },
    {
      title: '操作', width: 240, fixed: 'right' as const,
      render: (_: any, row: User) => (
        <Space size="small">
          <AuthButton permCode="user:detail">
            <a onClick={() => { setDetailTarget(row); setDetailVisible(true); }}>详情</a>
          </AuthButton>
          <AuthButton permCode="user:update">
            <a onClick={() => { setEditing(row); setEditVisible(true); }}>编辑</a>
          </AuthButton>
          <AuthButton permCode="user:reset-password">
            {isSelf(row.id, currentUserId) ? (
              <Tooltip title="请通过修改密码改自己">
                <a className="action-disabled">重置密码</a>
              </Tooltip>
            ) : (
              <a onClick={() => { setResetTarget(row); setResetVisible(true); }}>重置密码</a>
            )}
          </AuthButton>
          <AuthButton permCode="user:delete">
            {isSelf(row.id, currentUserId) ? (
              <Tooltip title="不能删除自己">
                <a className="action-disabled">删除</a>
              </Tooltip>
            ) : (
              <Popconfirm title="确定删除？" onConfirm={() => handleDelete(row.id)}>
                <a style={{ color: '#ff4d4f' }}>删除</a>
              </Popconfirm>
            )}
          </AuthButton>
        </Space>
      ),
    },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [currentUserId]);

  return (
    <Card title="用户管理" className="page-users">
      <Form
        layout="inline" style={{ marginBottom: 16 }}
        onFinish={(v) => {
          setPage(1);
          setFilters({
            keyword: v.keyword || undefined,
            status: v.status,
            registerSource: v.registerSource,
            startDate: v.range?.[0]?.toISOString(),
            endDate: v.range?.[1]?.toISOString(),
          });
        }}
        onReset={() => { setPage(1); setFilters({}); }}
      >
        <Form.Item name="keyword">
          <Input placeholder="用户名/邮箱/昵称/手机" allowClear style={{ width: 220 }} />
        </Form.Item>
        <Form.Item name="status">
          <Select
            placeholder="状态" allowClear style={{ width: 100 }}
            options={[{ label: '正常', value: 1 }, { label: '禁用', value: 0 }]}
          />
        </Form.Item>
        <Form.Item name="registerSource">
          <Select
            placeholder="注册来源" allowClear style={{ width: 140 }}
            options={REGISTER_SOURCE_OPTIONS}
          />
        </Form.Item>
        <Form.Item name="range">
          <RangePicker showTime />
        </Form.Item>
        <Form.Item>
          <Space>
            <Button type="primary" htmlType="submit">查询</Button>
            <Button htmlType="reset">重置</Button>
          </Space>
        </Form.Item>
      </Form>

      <Space style={{ marginBottom: 16 }}>
        <Button icon={<ReloadOutlined />} onClick={fetch}>刷新</Button>
        <AuthButton permCode="user:create">
          <Button
            type="primary" icon={<PlusOutlined />}
            onClick={() => { setEditing(null); setEditVisible(true); }}
          >
            新建用户
          </Button>
        </AuthButton>
      </Space>

      <Table
        rowKey="id"
        columns={columns}
        dataSource={data.list}
        loading={loading}
        pagination={{
          current: page, pageSize, total: data.total,
          showSizeChanger: true,
          showTotal: (t) => `共 ${t} 条`,
          onChange: (p, ps) => { setPage(p); setPageSize(ps); },
        }}
        scroll={{ x: 1380 }}
      />

      <UserModal
        visible={editVisible}
        editing={editing}
        onClose={() => setEditVisible(false)}
        onSuccess={fetch}
      />
      <ResetPwdModal
        visible={resetVisible}
        target={resetTarget}
        onClose={() => setResetVisible(false)}
      />
      <DetailDrawer
        visible={detailVisible}
        target={detailTarget}
        onClose={() => setDetailVisible(false)}
      />
    </Card>
  );
};

export default UsersPage;
