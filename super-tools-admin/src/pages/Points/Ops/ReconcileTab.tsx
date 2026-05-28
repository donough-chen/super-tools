import React, { useEffect, useState } from 'react';
import { Table, Button, Space, Switch, DatePicker, Tag } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import { Dayjs } from 'dayjs';
import { listReconcileSnapshots, ReconcileSnapshot } from '@/services/points';

/**
 * 对账查询 Tab
 *
 * 后端：GET /api/admin/points/reconcile（perm: points:reconcile:view）
 * 数据来源：points_balance_snapshots（每日 00:30 由定时任务生成）
 */
const ReconcileTab: React.FC = () => {
  const [list, setList] = useState<ReconcileSnapshot[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [loading, setLoading] = useState(false);
  const [date, setDate] = useState<Dayjs | null>(null);
  const [onlyAnomaly, setOnlyAnomaly] = useState(true);

  const fetchSnapshots = async () => {
    setLoading(true);
    try {
      const res: any = await listReconcileSnapshots({
        date: date ? date.format('YYYY-MM-DD') : undefined,
        onlyAnomaly,
        page,
        pageSize,
      });
      if (res?.code === 200) {
        setList(res.data?.list || []);
        setTotal(res.data?.total || 0);
      }
    } finally {
      setLoading(false);
    }
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    fetchSnapshots();
  }, [page, pageSize, date, onlyAnomaly]);

  const columns = [
    { title: 'ID', dataIndex: 'id', width: 80 },
    { title: '日期', dataIndex: 'date', width: 120 },
    { title: '用户 ID', dataIndex: 'userId', width: 100 },
    { title: '理论余额', dataIndex: 'theoryBalance', width: 100 },
    { title: '实际余额', dataIndex: 'actualBalance', width: 100 },
    {
      title: '差异',
      dataIndex: 'diff',
      width: 100,
      render: (v: number) => <Tag color={v === 0 ? 'green' : 'red'}>{v}</Tag>,
    },
    {
      title: '是否异常',
      dataIndex: 'isAnomaly',
      width: 100,
      render: (v: number) => (v ? <Tag color="red">异常</Tag> : <Tag color="green">正常</Tag>),
    },
  ];

  return (
    <>
      <Space style={{ marginBottom: 16 }}>
        <DatePicker
          value={date}
          onChange={(v) => {
            setPage(1);
            setDate(v);
          }}
        />
        <span>仅异常</span>
        <Switch
          checked={onlyAnomaly}
          onChange={(v) => {
            setPage(1);
            setOnlyAnomaly(v);
          }}
        />
        <Button icon={<ReloadOutlined />} onClick={fetchSnapshots}>
          刷新
        </Button>
      </Space>
      <Table
        rowKey="id"
        dataSource={list}
        columns={columns}
        loading={loading}
        pagination={{
          current: page,
          pageSize,
          total,
          showTotal: (t) => `共 ${t} 条`,
          showSizeChanger: true,
          onChange: (p, ps) => {
            setPage(p);
            setPageSize(ps);
          },
        }}
      />
    </>
  );
};

export default ReconcileTab;
