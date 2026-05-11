import React from 'react';
import { Drawer } from 'antd';
import type { Role } from '@/services/role';

interface Props {
  visible: boolean;
  role: Role | null;
  onClose: () => void;
  onSuccess: () => void;
}

/** 存根：完整实现见 T7 */
const AssignPermDrawer: React.FC<Props> = ({ visible, role, onClose }) => (
  <Drawer
    title={`赋权：${role?.name ?? ''}`}
    open={visible}
    onClose={onClose}
    width={600}
  >
    （T7 实现）
  </Drawer>
);

export default AssignPermDrawer;
