/**
 * Switch 开关组件
 * 纯 CSS + 状态控制，无依赖；用于隐私/通知/设备推送等设置页
 */
import React, { FC } from 'react';
import './Switch.less';

export interface SwitchProps {
  checked: boolean;
  disabled?: boolean;
  onChange: (next: boolean) => void;
  className?: string;
  ariaLabel?: string;
}

const Switch: FC<SwitchProps> = ({ checked, disabled, onChange, className = '', ariaLabel }) => {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      className={`st-switch ${checked ? 'st-switch--on' : ''} ${disabled ? 'st-switch--disabled' : ''} ${className}`}
      onClick={() => !disabled && onChange(!checked)}
    >
      <span className="st-switch__thumb" />
    </button>
  );
};

export default Switch;
