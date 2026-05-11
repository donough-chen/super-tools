import React from 'react';
import { Drawer } from 'antd';
import type { AuditLogDetail } from '@/services/audit-log';

interface Props {
  visible: boolean;
  detail: AuditLogDetail | null;
  loading: boolean;
  onClose: () => void;
}

/** 存根：完整实现见 T10 */
const AuditDetailDrawer: React.FC<Props> = ({ visible, onClose }) => (
  <Drawer title="审计详情" open={visible} onClose={onClose} width={1100}>
    （T10 实现）
  </Drawer>
);

export default AuditDetailDrawer;
