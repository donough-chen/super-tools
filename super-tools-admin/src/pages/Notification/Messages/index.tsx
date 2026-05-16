import React, { useEffect, useState } from 'react';
import { Table, Tag, Input, Select, Space, Drawer } from 'antd';
import { listMessages, detailMessage } from '@/services/notification';

export default () => {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<any>({});
  const [detail, setDetail] = useState<any>(null);

  const fetch = async () => {
    setLoading(true);
    try {
      const res = await listMessages({ ...filters, page, pageSize: 20 });
      if (res?.code === 200) {
        setData(res.data?.list || []);
        setTotal(res.data?.total || 0);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetch(); }, [page, filters]);

  const showDetail = async (id: number) => {
    const res = await detailMessage(id);
    if (res?.code === 200) setDetail(res.data);
  };

  const columns = [
    { title: 'ID', dataIndex: 'id', width: 60 },
    { title: '用户ID', dataIndex: 'userId', width: 80 },
    { title: '标题', dataIndex: 'title', width: 200, ellipsis: true },
    { title: '类型', dataIndex: ['type', 'name'], width: 100 },
    { title: '优先级', dataIndex: 'priority', width: 70 },
    {
      title: '已读', dataIndex: 'isRead', width: 60,
      render: (v: number) => v ? <Tag color="green">是</Tag> : <Tag>否</Tag>,
    },
    { title: '创建时间', dataIndex: 'createdAt', width: 170 },
    {
      title: '操作', width: 60,
      render: (_: any, r: any) => <a onClick={() => showDetail(r.id)}>详情</a>,
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <div style={{ marginBottom: 16 }}>
        <h3>消息记录</h3>
        <Space style={{ marginTop: 8 }}>
          <Input placeholder="用户ID" style={{ width: 120 }} onChange={(e) => setFilters((p: any) => ({ ...p, userId: e.target.value || undefined }))} allowClear />
          <Select placeholder="已读状态" style={{ width: 120 }} allowClear onChange={(v) => setFilters((p: any) => ({ ...p, isRead: v }))}>
            <Select.Option value={0}>未读</Select.Option>
            <Select.Option value={1}>已读</Select.Option>
          </Select>
        </Space>
      </div>
      <Table
        rowKey="id" columns={columns} dataSource={data} loading={loading}
        pagination={{ current: page, total, pageSize: 20, onChange: setPage }}
        size="small" scroll={{ x: 800 }}
      />
      <Drawer title="消息详情" open={!!detail} onClose={() => setDetail(null)} width={520}>
        {detail && (
          <div>
            <p><strong>标题：</strong>{detail.message?.title}</p>
            <div style={{ background: '#f5f5f5', padding: 12, borderRadius: 4, marginBottom: 16 }} dangerouslySetInnerHTML={{ __html: detail.message?.content }} />
            <p><strong>用户ID：</strong>{detail.message?.userId}</p>
            <p><strong>已读：</strong>{detail.message?.isRead ? '是' : '否'}</p>
            <p><strong>创建：</strong>{detail.message?.createdAt}</p>
            {detail.sendLogs?.length > 0 && (
              <>
                <h4 style={{ marginTop: 16 }}>发送日志</h4>
                <Table
                  rowKey="id" size="small" pagination={false}
                  dataSource={detail.sendLogs}
                  columns={[
                    { title: '渠道', dataIndex: 'channel', width: 80 },
                    { title: '状态', dataIndex: 'status', width: 80, render: (v: string) => <Tag>{v}</Tag> },
                    { title: '耗时', dataIndex: 'costMs', width: 60, render: (v: number) => v ? `${v}ms` : '-' },
                    { title: '时间', dataIndex: 'sentAt', width: 170 },
                  ]}
                />
              </>
            )}
          </div>
        )}
      </Drawer>
    </div>
  );
};
