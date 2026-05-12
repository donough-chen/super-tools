import React from 'react';
import { Tag } from 'antd';
import { STATUS_LABELS, STATUS_COLORS } from '@/utils/feedbackStatus';

const StatusTag: React.FC<{ status: number }> = ({ status }) => (
  <Tag color={STATUS_COLORS[status]}>{STATUS_LABELS[status]}</Tag>
);

export default StatusTag;
