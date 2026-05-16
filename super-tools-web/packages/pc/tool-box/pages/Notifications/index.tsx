import React, { useEffect, useState, useCallback } from 'react';
import { List, Badge, Button, Empty, Tabs, message } from 'antd';
import { BellOutlined, CheckOutlined } from '@ant-design/icons';
import { request } from '../../../../shared/utils';
import './index.less';

const NotificationsPage: React.FC = () => {
  const [list, setList] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [tab, setTab] = useState('unread');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params: any = { page, pageSize: 20 };
      if (tab === 'unread') params.isRead = 0;
      if (tab === 'read') params.isRead = 1;
      const res = await request('/api/notifications', { params });
      if (res?.code === 200) {
        setList(res.data?.list || []);
        setTotal(res.data?.total || 0);
      }
    } finally {
      setLoading(false);
    }
  }, [page, tab]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleMarkRead = async (id: number) => {
    await request('/api/notifications/mark-read', { method: 'POST', data: { ids: [id] } });
    fetchData();
  };

  const handleMarkAllRead = async () => {
    await request('/api/notifications/mark-all-read', { method: 'POST' });
    message.success('已全部标记已读');
    fetchData();
  };

  return (
    <div className="notifications-page">
      <div className="notifications-page__header">
        <h2><BellOutlined /> 消息中心</h2>
        <Button icon={<CheckOutlined />} onClick={handleMarkAllRead}>全部已读</Button>
      </div>
      <Tabs
        activeKey={tab}
        onChange={(k) => { setTab(k); setPage(1); }}
        items={[
          { key: 'all', label: '全部' },
          { key: 'unread', label: '未读' },
          { key: 'read', label: '已读' },
        ]}
      />
      <List
        loading={loading}
        dataSource={list}
        locale={{ emptyText: <Empty description="暂无消息" /> }}
        pagination={{
          current: page, total, pageSize: 20,
          onChange: (p) => setPage(p),
        }}
        renderItem={(item: any) => (
          <List.Item
            actions={!item.isRead ? [
              <a key="read" onClick={() => handleMarkRead(item.id)}>标为已读</a>,
            ] : undefined}
          >
            <List.Item.Meta
              avatar={<Badge dot={!item.isRead}><BellOutlined style={{ fontSize: 20 }} /></Badge>}
              title={<span style={{ fontWeight: item.isRead ? 400 : 600 }}>{item.title || '通知'}</span>}
              description={
                <div>
                  <div style={{ color: '#666' }}>{item.summary || item.content?.substring(0, 100)}</div>
                  <div style={{ color: '#999', fontSize: 12, marginTop: 4 }}>{item.createdAt?.substring(0, 16)}</div>
                </div>
              }
            />
          </List.Item>
        )}
      />
    </div>
  );
};

export default NotificationsPage;
