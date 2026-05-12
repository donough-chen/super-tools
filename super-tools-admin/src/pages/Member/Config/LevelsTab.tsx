import React, { useEffect, useMemo, useState } from 'react';
import {
  Table, Button, Switch, Tag, Avatar, message, Space,
} from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import AuthButton from '@/components/AuthButton';
import { listLevels, updateLevel, MemberLevel } from '@/services/member';
import { formatCurrency } from '@/utils/memberFormat';
import LevelModal from './LevelModal';

const LevelsTab: React.FC = () => {
  const [list, setList] = useState<MemberLevel[]>([]);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState<MemberLevel | null>(null);
  const [modalVisible, setModalVisible] = useState(false);

  const fetch = async () => {
    setLoading(true);
    try {
      const res: any = await listLevels();
      if (res?.code === 200) setList(res.data || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetch(); }, []);

  const handleStatus = async (row: MemberLevel, c: boolean) => {
    const res: any = await updateLevel(row.id, { status: c ? 1 : 0 });
    if (res?.code === 200) {
      message.success('已更新');
      fetch();
    } else {
      message.error(res?.message || '更新失败');
    }
  };

  const columns = useMemo(() => [
    { title: 'ID', dataIndex: 'id', width: 60 },
    { title: '等级', dataIndex: 'level', width: 70 },
    {
      title: '编码', dataIndex: 'code', width: 110,
      render: (v: string) => <Tag>{v}</Tag>,
    },
    { title: '名称', dataIndex: 'name', width: 110 },
    {
      title: '图标', dataIndex: 'icon', width: 60,
      render: (v: string) => <Avatar src={v} size="small">{!v && '?'}</Avatar>,
    },
    {
      title: '颜色', dataIndex: 'color', width: 130,
      render: (v: string) => v ? (
        <Space size={4}>
          <span style={{
            display: 'inline-block', width: 14, height: 14,
            background: v, borderRadius: 2, border: '1px solid #ddd',
          }} />
          <code style={{ fontSize: 12 }}>{v}</code>
        </Space>
      ) : '-',
    },
    { title: '升级积分', dataIndex: 'upgradePoints', width: 100 },
    { title: '升级成长', dataIndex: 'upgradeGrowth', width: 100 },
    {
      title: '升级消费', dataIndex: 'upgradeConsume', width: 110,
      render: (v: any) => formatCurrency(v),
    },
    { title: '排序', dataIndex: 'sort', width: 70 },
    {
      title: '状态', dataIndex: 'status', width: 80,
      render: (v: number, row: MemberLevel) => (
        <AuthButton permCode="member:level:update">
          <Switch checked={v === 1} onChange={(c) => handleStatus(row, c)} />
        </AuthButton>
      ),
    },
    {
      title: '操作', width: 80, fixed: 'right' as const,
      render: (_: any, row: MemberLevel) => (
        <AuthButton permCode="member:level:update">
          <a onClick={() => { setEditing(row); setModalVisible(true); }}>编辑</a>
        </AuthButton>
      ),
    },
  ], []);

  return (
    <>
      <Space style={{ marginBottom: 16 }}>
        <Button icon={<ReloadOutlined />} onClick={fetch}>刷新</Button>
      </Space>
      <Table
        rowKey="id"
        columns={columns}
        dataSource={list}
        loading={loading}
        pagination={false}
        scroll={{ x: 1280 }}
      />
      <LevelModal
        visible={modalVisible}
        editing={editing}
        onClose={() => setModalVisible(false)}
        onSuccess={fetch}
      />
    </>
  );
};

export default LevelsTab;
