import React, { useEffect, useState, useCallback } from 'react';
import { Badge, Popover, List, Button, Empty, message } from 'antd';
import { BellOutlined } from '@ant-design/icons';
import { history } from 'umi';
import { unreadCount, listMyNotifications, markRead, markAllRead } from '@/services/notification';

const NotificationBell: React.FC = () => {
  const [count, setCount] = useState(0);
  const [visible, setVisible] = useState(false);
  const [list, setList] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchCount = useCallback(async () => {
    try {
      const res = await unreadCount();
      if (res?.code === 200) setCount(res.data?.count || 0);
    } catch {}
  }, []);

  const fetchList = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listMyNotifications({ page: 1, pageSize: 5, isRead: 0 });
      if (res?.code === 200) setList(res.data?.list || []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCount();
    const timer = setInterval(fetchCount, 30000); // 每 30s 轮询
    return () => clearInterval(timer);
  }, [fetchCount]);

  useEffect(() => {
    if (visible) fetchList();
  }, [visible, fetchList]);

  const handleRead = async (id: number) => {
    await markRead([id]);
    setList((prev) => prev.filter((i) => i.id !== id));
    setCount((c) => Math.max(0, c - 1));
  };

  const handleReadAll = async () => {
    await markAllRead();
    message.success('已全部标记已读');
    setList([]);
    setCount(0);
  };

  const content = (
    <div style={{ width: 320 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0 0 8px' }}>
        <strong>通知 ({count})</strong>
        {count > 0 && <a onClick={handleReadAll}>全部已读</a>}
      </div>
      {list.length === 0 ? (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无未读通知" />
      ) : (
        <List
          loading={loading} size="small"
          dataSource={list}
          renderItem={(item: any) => (
            <List.Item
              actions={[<a key="read" onClick={() => handleRead(item.id)}>已读</a>]}
              style={{ cursor: 'pointer' }}
            >
              <List.Item.Meta
                title={<span style={{ fontSize: 13 }}>{item.title || '通知'}</span>}
                description={<span style={{ fontSize: 12, color: '#999' }}>{item.summary || item.content?.substring(0, 60)}</span>}
              />
            </List.Item>
          )}
        />
      )}
      <div style={{ textAlign: 'center', paddingTop: 8, borderTop: '1px solid #f0f0f0' }}>
        <Button type="link" onClick={() => { setVisible(false); history.push('/notification/messages'); }}>
          查看全部
        </Button>
      </div>
    </div>
  );

  return (
    <Popover content={content} trigger="click" open={visible} onOpenChange={setVisible} placement="bottomRight">
      <Badge count={count} size="small" offset={[-2, 2]}>
        <BellOutlined style={{ fontSize: 18, cursor: 'pointer', padding: '0 12px' }} />
      </Badge>
    </Popover>
  );
};

export default NotificationBell;
