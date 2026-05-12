import React, { useEffect, useState } from 'react';
import { Table, Tag } from 'antd';
import { listUserDevices, UserDevice } from '@/services/user';
import { formatDateTime } from '@/utils/format';

interface Props {
  userId?: number;
  /** 仅当 Tab 激活时拉取（懒加载，避免 Drawer 打开时一次性请求 3 个 Tab） */
  active?: boolean;
}

const DevicesTab: React.FC<Props> = ({ userId, active }) => {
  const [list, setList] = useState<UserDevice[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!userId) {
      setList([]);
      setLoaded(false);
      return;
    }
    if (!active && !loaded) return;  // 懒加载
    setLoading(true);
    listUserDevices(userId)
      .then((r: any) => { if (r?.code === 200) setList(r.data || []); setLoaded(true); })
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, active]);

  return (
    <Table<UserDevice>
      rowKey="id"
      dataSource={list}
      loading={loading}
      pagination={false}
      size="small"
      columns={[
        { title: '设备名', dataIndex: 'deviceName', render: (v) => v || '-' },
        { title: '类型', dataIndex: 'deviceType', width: 90 },
        { title: 'OS 版本', dataIndex: 'osVersion', width: 100, render: (v) => v || '-' },
        { title: 'App 版本', dataIndex: 'appVersion', width: 100, render: (v) => v || '-' },
        { title: '推送', dataIndex: 'pushEnabled', width: 80,
          render: (v) => v ? <Tag color="green">开</Tag> : <Tag>关</Tag> },
        { title: '最后活跃', dataIndex: 'lastActiveAt', width: 160,
          render: (v) => formatDateTime(v) },
        { title: '状态', dataIndex: 'status', width: 90,
          render: (v) => v === 1 ? <Tag color="green">在线</Tag> : <Tag>已移除</Tag> },
      ]}
    />
  );
};

export default DevicesTab;
