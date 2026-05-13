import React, { useEffect, useState, useMemo } from 'react';
import {
  Card, Table, Button, Input, Space, Switch, Popconfirm, message, Tag, Tooltip, Form, Select,
} from 'antd';
import { PlusOutlined, ReloadOutlined } from '@ant-design/icons';
import AuthButton from '@/components/AuthButton';
import { listRoles, deleteRole, updateRole, RoleListQuery, Role } from '@/services/role';
import RoleModal from './RoleModal';
import AssignPermDrawer from './AssignPermDrawer';
import AssignUsersDrawer from './AssignUsersDrawer';
import './index.less';

const isSuperAdmin = (row: Role) => row.code === 'super_admin';

const RolesPage: React.FC = () => {
  const [data, setData] = useState<{ list: Role[]; total: number }>({ list: [], total: 0 });
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [filters, setFilters] = useState<RoleListQuery>({});
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [usersDrawerVisible, setUsersDrawerVisible] = useState(false);
  const [usersDrawerRole, setUsersDrawerRole] = useState<Role | null>(null);

  const fetch = async () => {
    setLoading(true);
    try {
      const res: any = await listRoles({ page, pageSize, ...filters });
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
  }, [page, pageSize, filters]);

  const handleStatusToggle = async (row: Role, c: boolean) => {
    if (isSuperAdmin(row)) {
      message.warning('超级管理员不可禁用');
      return;
    }
    const res: any = await updateRole(row.id, { status: c ? 1 : 0 });
    if (res?.code === 200) {
      message.success('已更新');
      fetch();
    } else {
      message.error(res?.message || '更新失败');
    }
  };

  const handleDelete = async (id: number) => {
    const res: any = await deleteRole(id);
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
      title: '编码', dataIndex: 'code', width: 160,
      render: (v: string) => <Tag>{v}</Tag>,
    },
    { title: '名称', dataIndex: 'name', width: 160 },
    { title: '描述', dataIndex: 'description', ellipsis: true },
    {
      title: '状态', dataIndex: 'status', width: 100,
      render: (v: number, row: Role) => (
        <Switch
          checked={v === 1}
          disabled={isSuperAdmin(row)}
          onChange={(c) => handleStatusToggle(row, c)}
        />
      ),
    },
    { title: '排序', dataIndex: 'sort', width: 70 },
    { title: '创建时间', dataIndex: 'createdAt', width: 180 },
    {
      title: '操作', width: 220, fixed: 'right' as const,
      render: (_: any, row: Role) => (
        <Space>
          {isSuperAdmin(row) ? (
            <Tooltip title="超级管理员权限固定，请联系研发团队">
              <a className="super-admin-disabled">编辑</a>
            </Tooltip>
          ) : (
            <AuthButton permCode="role:update">
              <a onClick={() => { setSelectedRole(row); setModalVisible(true); }}>编辑</a>
            </AuthButton>
          )}

          {isSuperAdmin(row) ? (
            <Tooltip title="超级管理员拥有全部权限，无需赋权">
              <a className="super-admin-disabled">赋权</a>
            </Tooltip>
          ) : (
            <AuthButton permCode="role:assign-permissions">
              <a onClick={() => { setSelectedRole(row); setDrawerVisible(true); }}>赋权</a>
            </AuthButton>
          )}

          {isSuperAdmin(row) ? (
            <Tooltip title="超级管理员成员不可管理">
              <a className="super-admin-disabled">成员</a>
            </Tooltip>
          ) : (
            <AuthButton permCode="system:role:assign-users">
              <a onClick={() => { setUsersDrawerRole(row); setUsersDrawerVisible(true); }}>成员</a>
            </AuthButton>
          )}

          {!isSuperAdmin(row) && (
            <AuthButton permCode="role:delete">
              <Popconfirm title="确定删除？" onConfirm={() => handleDelete(row.id)}>
                <a style={{ color: '#ff4d4f' }}>删除</a>
              </Popconfirm>
            </AuthButton>
          )}
        </Space>
      ),
    },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ], []);

  return (
    <Card title="角色管理" className="page-system-roles">
      <Form
        layout="inline"
        style={{ marginBottom: 16 }}
        onFinish={(v) => {
          setPage(1);
          setFilters({
            keyword: v.keyword || undefined,
            status: v.status,
          });
        }}
      >
        <Form.Item name="keyword">
          <Input placeholder="编码/名称搜索" allowClear style={{ width: 200 }} />
        </Form.Item>
        <Form.Item name="status">
          <Select
            placeholder="状态" allowClear style={{ width: 120 }}
            options={[{ label: '启用', value: 1 }, { label: '停用', value: 0 }]}
          />
        </Form.Item>
        <Form.Item>
          <Button type="primary" htmlType="submit">查询</Button>
        </Form.Item>
      </Form>

      <Space style={{ marginBottom: 16 }}>
        <Button icon={<ReloadOutlined />} onClick={fetch}>刷新</Button>
        <AuthButton permCode="role:create">
          <Button type="primary" icon={<PlusOutlined />}
            onClick={() => { setSelectedRole(null); setModalVisible(true); }}>
            新建角色
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
        scroll={{ x: 1100 }}
      />

      <RoleModal
        visible={modalVisible}
        editing={selectedRole}
        onClose={() => setModalVisible(false)}
        onSuccess={fetch}
      />

      <AssignPermDrawer
        visible={drawerVisible}
        role={selectedRole}
        onClose={() => setDrawerVisible(false)}
        onSuccess={fetch}
      />

      <AssignUsersDrawer
        visible={usersDrawerVisible}
        role={usersDrawerRole}
        onClose={() => setUsersDrawerVisible(false)}
        onSuccess={fetch}
      />
    </Card>
  );
};

export default RolesPage;
