import React from 'react';
import { Drawer } from 'antd';
import { User } from '@/services/user';

interface Props {
  visible: boolean;
  target: User | null;
  onClose: () => void;
}

/** 占位实现，T10 替换为含 3 Tab 的完整版 */
const DetailDrawer: React.FC<Props> = ({ visible, target, onClose }) => (
  <Drawer
    open={visible}
    onClose={onClose}
    title={`用户详情 #${target?.id ?? ''}（构建中）`}
    width={720}
  />
);

export default DetailDrawer;
