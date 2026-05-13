import React, { useEffect, useState } from 'react';
import {
  Drawer, Table, Button, Space, Input, Popconfirm, message, Select, Avatar,
} from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import type { Role } from '@/services/role';
import { getRoleUsers, assignRoleUsers, removeRoleUser } from '@/services/role';
import { listUsers } from '@/services/user';

interface Props {
  visible: boolean;
  role: Role | null;
  onClose: () => void;
  onSuccess: () => void;
}

const AssignUsersDrawer: React.FC<Props> = ({ visible, role, onClose, onSuccess }) => {
  const [data, setData] = useState<{ list: any[]; total: number }>({ list: [], total: 0 });
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [keyword, setKeyword] = useState('');

  const [addVisible, setAddVisible] = useState(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [selectedUserIds, setSelectedUserIds] = useState<number[]>([]);
  const [adding, setAdding] = useState(false);

  const fetchUsers = async () => {
    if (!role) return;
    setLoading(true);
    try {
      const res: any = await getRoleUsers(role.id, { page, pageSize: 10, keyword: keyword || undefined });
      if (res?.code === 200 && res.data) {
        setData({ list: res.data.list || [], total: res.data.total || 0 });
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (visible && role) {
      setPage(1);
      setKeyword('');
      setAddVisible(false);
      setSelectedUserIds([]);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, role]);

  useEffect(() => {
    if (visible && role) fetchUsers();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, role, page, keyword]);

  const handleRemove = async (userId: number) => {
    if (!role) return;
    const res: any = await removeRoleUser(role.id, userId);
    if (res?.code === 200) {
      message.success('已移除');
      fetchUsers();
      onSuccess();
    } else {
      message.error(res?.message || '移除失败');
    }
  };

  const handleSearch = async (value: string) => {
    if (!value || value.length < 2) { setSearchResults([]); return; }
    const res: any = await listUsers({ keyword: value, pageSize: 20 });
    if (res?.code === 200) {
      setSearchResults(res.data?.list || []);
    }
  };

  const handleAdd = async () => {
    if (!role || selectedUserIds.length === 0) return;
    setAdding(true);
    try {
      const res: any = await assignRoleUsers(role.id, selectedUserIds);
      if (res?.code === 200) {
        message.success(`已添加 ${selectedUserIds.length} 个用户`);
        setSelectedUserIds([]);
        setAddVisible(false);
        fetchUsers();
        onSuccess();
      } else {
        message.error(res?.message || '添加失败');
      }
    } finally {
      setAdding(false);
    }
  };

  const columns = [
    { title: 'ID', dataIndex: 'id', width: 70 },
    {
      title: '用户', dataIndex: 'username', width: 160,
      render: (v: string, row: any) => (
        <Space>
          <Avatar src={row.avatar} size="small">{v?.[0]?.toUpperCase()}</Avatar>
          {row.nickname || v}
        </Space>
      ),
    },
    { title: '邮箱', dataIndex: 'email', width: 180, render: (v: string) => v || '-' },
    { title: '手机', dataIndex: 'phone', width: 130, render: (v: string) => v || '-' },
    {
      title: '操作', width: 80,
      render: (_: any, row: any) => (
        <Popconfirm title="确定移除？" onConfirm={() => handleRemove(row.id)}>
          <a style={{ color: '#ff4d4f' }}>移除</a>
        </Popconfirm>
      ),
    },
  ];

  return (
    <Drawer
      title={role ? `管理成员 - ${role.name} (${role.code})` : '管理成员'}
      open={visible}
      onClose={onClose}
      width={700}
      destroyOnClose
    >
      <Space style={{ marginBottom: 16, width: '100%', justifyContent: 'space-between' }}>
        <Input.Search
          placeholder="搜索用户名/昵称/邮箱"
          allowClear
          style={{ width: 240 }}
          onSearch={(v) => { setPage(1); setKeyword(v); }}
        />
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setAddVisible(true)}>
          添加成员
        </Button>
      </Space>

      <Table
        rowKey="id"
        columns={columns}
        dataSource={data.list}
        loading={loading}
        pagination={{
          current: page, pageSize: 10, total: data.total,
          onChange: (p) => setPage(p),
          showTotal: (t) => `共 ${t} 人`,
        }}
        size="small"
      />

      {addVisible && (
        <div style={{ marginTop: 24, padding: 16, background: '#fafafa', borderRadius: 8 }}>
          <Space direction="vertical" style={{ width: '100%' }}>
            <Select
              mode="multiple"
              placeholder="搜索并选择用户（至少输入2字）"
              style={{ width: '100%' }}
              showSearch
              filterOption={false}
              onSearch={handleSearch}
              value={selectedUserIds}
              onChange={setSelectedUserIds}
              options={searchResults.map((u: any) => ({
                label: `${u.nickname || u.username} (${u.email || u.phone || u.username})`,
                value: u.id,
              }))}
            />
            <Space>
              <Button type="primary" loading={adding} onClick={handleAdd}
                disabled={selectedUserIds.length === 0}>
                确认添加 ({selectedUserIds.length})
              </Button>
              <Button onClick={() => { setAddVisible(false); setSelectedUserIds([]); }}>
                取消
              </Button>
            </Space>
          </Space>
        </div>
      )}
    </Drawer>
  );
};

export default AssignUsersDrawer;
