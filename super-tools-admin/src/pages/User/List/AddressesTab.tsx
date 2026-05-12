import React, { useEffect, useState } from 'react';
import { Table, Tag } from 'antd';
import { listUserAddresses, UserAddress } from '@/services/user';

interface Props {
  userId?: number;
  /** 仅当 Tab 激活时拉取（懒加载） */
  active?: boolean;
}

const AddressesTab: React.FC<Props> = ({ userId, active }) => {
  const [list, setList] = useState<UserAddress[]>([]);
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
    listUserAddresses(userId)
      .then((r: any) => { if (r?.code === 200) setList(r.data || []); setLoaded(true); })
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, active]);

  return (
    <Table<UserAddress>
      rowKey="id"
      dataSource={list}
      loading={loading}
      pagination={false}
      size="small"
      columns={[
        { title: '收件人', dataIndex: 'receiver', width: 100 },
        { title: '电话', dataIndex: 'phone', width: 130 },
        { title: '省', dataIndex: 'province', width: 100 },
        { title: '市', dataIndex: 'city', width: 100 },
        { title: '区', dataIndex: 'district', width: 100 },
        { title: '详细', dataIndex: 'address', ellipsis: true },
        { title: '默认', dataIndex: 'isDefault', width: 80,
          render: (v) => v ? <Tag color="blue">默认</Tag> : '-' },
      ]}
    />
  );
};

export default AddressesTab;
