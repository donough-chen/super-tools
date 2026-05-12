import React, { useEffect, useMemo, useState } from 'react';
import {
  Table, Button, Input, Space, Form, Select, Tag,
} from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import AuthButton from '@/components/AuthButton';
import {
  listMemberUsers, listLevels,
  MemberUser, MemberUserListQuery, MemberLevel,
} from '@/services/member';
import { formatCurrency } from '@/utils/memberFormat';
import { formatDateTime } from '@/utils/format';
import DetailDrawer from './DetailDrawer';

interface Props {
  onJumpToLogs?: (userId: number) => void;
}

const UsersTab: React.FC<Props> = ({ onJumpToLogs }) => {
  const [data, setData] = useState<{ list: MemberUser[]; total: number }>({ list: [], total: 0 });
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [filters, setFilters] = useState<MemberUserListQuery>({});
  const [levels, setLevels] = useState<MemberLevel[]>([]);
  const [target, setTarget] = useState<MemberUser | null>(null);
  const [drawerVisible, setDrawerVisible] = useState(false);

  // 拉等级列表用作筛选下拉
  useEffect(() => {
    listLevels().then((r: any) => {
      if (r?.code === 200) setLevels(r.data || []);
    });
  }, []);

  const fetch = async () => {
    setLoading(true);
    try {
      const res: any = await listMemberUsers({ page, pageSize, ...filters });
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

  const columns = useMemo(() => [
    { title: 'ID', dataIndex: 'id', width: 70 },
    {
      title: '用户', dataIndex: 'user', width: 160,
      render: (u: any, row: MemberUser) =>
        u
          ? `${u.nickname || '-'}(#${row.userId})`
          : `#${row.userId}`,
    },
    {
      title: '等级', dataIndex: 'level', width: 110,
      render: (lv: any) => lv ? (
        <Tag color={lv.color || 'default'}>{lv.name}</Tag>
      ) : '-',
    },
    { title: '当前积分', dataIndex: 'points', width: 100 },
    { title: '累计积分', dataIndex: 'totalPoints', width: 100 },
    { title: '成长值', dataIndex: 'growthValue', width: 100 },
    {
      title: '累计消费', dataIndex: 'totalConsume', width: 110,
      render: (v: any) => formatCurrency(v),
    },
    {
      title: '付费', dataIndex: 'isPaid', width: 80,
      render: (v: number) => v === 1
        ? <Tag color="gold">是</Tag>
        : <Tag>否</Tag>,
    },
    {
      title: '套餐', dataIndex: 'paidPlanCode', width: 110,
      render: (v: string) => v ? <Tag>{v}</Tag> : '-',
    },
    {
      title: '到期时间', dataIndex: 'paidExpireAt', width: 160,
      render: (v: string) => formatDateTime(v),
    },
    {
      title: '操作', width: 90, fixed: 'right' as const,
      render: (_: any, row: MemberUser) => (
        <AuthButton permCode="member:user:list">
          <a onClick={() => { setTarget(row); setDrawerVisible(true); }}>详情</a>
        </AuthButton>
      ),
    },
  ], []);

  return (
    <>
      <Form
        layout="inline" style={{ marginBottom: 16 }}
        onFinish={(v) => {
          setPage(1);
          setFilters({
            keyword: v.keyword || undefined,
            levelCode: v.levelCode,
            isPaid: v.isPaid,
          });
        }}
        onReset={() => { setPage(1); setFilters({}); }}
      >
        <Form.Item name="keyword">
          <Input placeholder="昵称/手机/邮箱" allowClear style={{ width: 200 }} />
        </Form.Item>
        <Form.Item name="levelCode">
          <Select
            placeholder="等级" allowClear style={{ width: 130 }}
            options={levels.map((l) => ({ value: l.code, label: l.name }))}
          />
        </Form.Item>
        <Form.Item name="isPaid">
          <Select
            placeholder="付费状态" allowClear style={{ width: 120 }}
            options={[
              { value: 1, label: '已付费' },
              { value: 0, label: '未付费' },
            ]}
          />
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
        scroll={{ x: 1300 }}
      />

      <DetailDrawer
        visible={drawerVisible}
        target={target}
        onClose={() => setDrawerVisible(false)}
        onSuccess={fetch}
        onJumpToLogs={onJumpToLogs}
      />
    </>
  );
};

export default UsersTab;
