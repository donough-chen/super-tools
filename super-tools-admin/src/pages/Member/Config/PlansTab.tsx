import React, { useEffect, useMemo, useState } from 'react';
import { Table, Button, Switch, Tag, message, Space } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import AuthButton from '@/components/AuthButton';
import { listPlans, updatePlan, PaidPlan } from '@/services/member';
import { formatCurrency, formatDuration } from '@/utils/memberFormat';
import PlanModal from './PlanModal';

const PlansTab: React.FC = () => {
  const [list, setList] = useState<PaidPlan[]>([]);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState<PaidPlan | null>(null);
  const [modalVisible, setModalVisible] = useState(false);

  const fetch = async () => {
    setLoading(true);
    try {
      const res: any = await listPlans();
      if (res?.code === 200) setList(res.data || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetch(); }, []);

  const handleStatus = async (row: PaidPlan, c: boolean) => {
    const res: any = await updatePlan(row.id, { status: c ? 1 : 0 });
    if (res?.code === 200) {
      message.success('已更新');
      fetch();
    } else {
      message.error(res?.message || '更新失败');
    }
  };

  const columns = useMemo(() => [
    { title: 'ID', dataIndex: 'id', width: 60 },
    {
      title: '编码', dataIndex: 'code', width: 110,
      render: (v: string) => <Tag>{v}</Tag>,
    },
    { title: '名称', dataIndex: 'name', width: 130 },
    {
      title: '时长', dataIndex: 'durationDays', width: 100,
      render: (v: number) => formatDuration(v),
    },
    {
      title: '售价', dataIndex: 'price', width: 110,
      render: (v: any) => <strong style={{ color: '#fa541c' }}>{formatCurrency(v)}</strong>,
    },
    {
      title: '原价', dataIndex: 'originalPrice', width: 110,
      render: (v: any) => <s style={{ color: '#999' }}>{formatCurrency(v)}</s>,
    },
    { title: '赠送积分', dataIndex: 'giftPoints', width: 100 },
    { title: '赠送成长', dataIndex: 'giftGrowth', width: 100 },
    { title: '排序', dataIndex: 'sort', width: 70 },
    {
      title: '状态', dataIndex: 'status', width: 80,
      render: (v: number, row: PaidPlan) => (
        <AuthButton permCode="member:plan:update">
          <Switch checked={v === 1} onChange={(c) => handleStatus(row, c)} />
        </AuthButton>
      ),
    },
    {
      title: '操作', width: 80, fixed: 'right' as const,
      render: (_: any, row: PaidPlan) => (
        <AuthButton permCode="member:plan:update">
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
        scroll={{ x: 1180 }}
      />
      <PlanModal
        visible={modalVisible}
        editing={editing}
        onClose={() => setModalVisible(false)}
        onSuccess={fetch}
      />
    </>
  );
};

export default PlansTab;
