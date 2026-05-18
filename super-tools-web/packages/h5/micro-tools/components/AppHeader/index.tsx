/**
 * AppHeader 头部导航组件
 * 毛玻璃效果 + 标题居左 + 按钮组居右
 */
import React, { FC, ReactNode } from 'react';
import classnames from 'classnames';
import { useNotificationStore } from '../../store';
import './AppHeader.less';

export interface HeaderButtonConfig {
  type: 'search' | 'agent' | 'settings' | 'sort' | 'add' | 'scan' | 'message' | 'placeholder';
  visible?: boolean | (() => boolean);
  onClick?: () => void;
}

export interface AppHeaderProps {
  title: string;
  buttons?: HeaderButtonConfig[];
  /** 是否显示返回按钮（二级页面使用） */
  showBack?: boolean;
  onBack?: () => void;
  /**
   * 右侧自定义插槽：与 buttons 互斥。
   * 用于需要展示文字按钮（如「保存」）等无法通过预设 type 表达的场景
   * 当传入时优先使用 rightSlot，忽略 buttons
   */
  rightSlot?: ReactNode;
}

const AppHeader: FC<AppHeaderProps> = ({
  title,
  buttons = [],
  showBack = false,
  onBack,
  rightSlot,
}) => {
  const unreadCount = useNotificationStore(s => s.unreadCount);

  const isButtonVisible = (config: HeaderButtonConfig) => {
    if (typeof config.visible === 'function') return config.visible();
    if (typeof config.visible === 'boolean') return config.visible;
    return true;
  };

  const renderButton = (btn: HeaderButtonConfig, idx: number) => {
    if (btn.type === 'message') {
      return (
        <div
          key={`${btn.type}-${idx}`}
          className={classnames('app-header__btn', 'app-header__btn--message')}
          onClick={btn.onClick}
          aria-label="消息"
        >
          {unreadCount > 0 && (
            <span className="app-header__badge">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </div>
      );
    }
    return (
      <div
        key={`${btn.type}-${idx}`}
        className={classnames('app-header__btn', `app-header__btn--${btn.type}`)}
        onClick={btn.onClick}
        aria-label={btn.type}
      />
    );
  };

  return (
    <header className="app-header">
      <div className="app-header__inner">
        {showBack && (
          <div className="app-header__back" onClick={onBack} aria-label="返回" />
        )}
        <h1 className="app-header__title">{title}</h1>
        <div className="app-header__actions">
          {rightSlot
            ? rightSlot
            : buttons
              .filter(isButtonVisible)
              .map(renderButton)}
        </div>
      </div>
    </header>
  );
};

export default AppHeader;
