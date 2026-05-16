import React, { useEffect, useState } from 'react';
import { Statistic } from 'antd';
import { BellOutlined } from '@ant-design/icons';
import { unreadCount } from '@/services/notification';

export default function UnreadCountWidget() {
  const [count, setCount] = useState(0);
  useEffect(() => {
    unreadCount().then((r: any) => setCount(r?.data?.count ?? 0));
  }, []);
  return <Statistic title="未读通知" value={count} prefix={<BellOutlined />} />;
}
