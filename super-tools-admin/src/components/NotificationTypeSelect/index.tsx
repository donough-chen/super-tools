import React from 'react';
import { Select } from 'antd';

export interface NotificationTypeOption {
  label: string;
  value: number;
}

interface NotificationTypeSelectProps {
  value?: number;
  onChange?: (value: number) => void;
  options?: NotificationTypeOption[];
  loading?: boolean;
  placeholder?: string;
  style?: React.CSSProperties;
  disabled?: boolean;
}

/**
 * 通知类型下拉选择组件（纯展示）
 * - 数据由父组件传入，避免重复请求
 * - 选项格式：名称[ID] (code)
 * - 选中后表单值为 ID
 */
const NotificationTypeSelect: React.FC<NotificationTypeSelectProps> = ({
  value,
  onChange,
  options = [],
  loading = false,
  placeholder = '请选择通知类型',
  style,
  disabled,
}) => {
  return (
    <Select
      value={value}
      onChange={onChange}
      options={options}
      loading={loading}
      placeholder={placeholder}
      style={style}
      disabled={disabled}
      showSearch
      filterOption={(input, option) =>
        String(option?.label ?? '')
          .toLowerCase()
          .includes(input.toLowerCase())
      }
      allowClear
    />
  );
};

export default NotificationTypeSelect;
