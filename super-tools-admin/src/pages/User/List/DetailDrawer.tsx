import React, { useEffect, useState } from 'react';
import { Drawer, Tabs, Spin } from 'antd';
import { getUser, User } from '@/services/user';
import BasicInfoTab from './BasicInfoTab';
import DevicesTab from './DevicesTab';
import AddressesTab from './AddressesTab';

interface Props {
  visible: boolean;
  target: User | null;
  onClose: () => void;
}

const DetailDrawer: React.FC<Props> = ({ visible, target, onClose }) => {
  const [tab, setTab] = useState<'basic' | 'devices' | 'addresses'>('basic');
  const [detail, setDetail] = useState<User | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (visible && target) {
      setTab('basic');
      setLoading(true);
      getUser(target.id)
        .then((r: any) => { if (r?.code === 200) setDetail(r.data); })
        .finally(() => setLoading(false));
    } else if (!visible) {
      setDetail(null);
    }
  }, [visible, target]);

  return (
    <Drawer
      title={`用户详情 #${target?.id ?? ''}`}
      width={720} open={visible} onClose={onClose} destroyOnClose
    >
      <Spin spinning={loading}>
        <Tabs
          activeKey={tab}
          onChange={(k) => setTab(k as any)}
          items={[
            { key: 'basic', label: '基础信息', children: <BasicInfoTab user={detail} /> },
            { key: 'devices', label: '设备', children: <DevicesTab userId={target?.id} active={tab === 'devices'} /> },
            { key: 'addresses', label: '地址', children: <AddressesTab userId={target?.id} active={tab === 'addresses'} /> },
          ]}
        />
      </Spin>
    </Drawer>
  );
};

export default DetailDrawer;
