/**
 * AppTabBar 底部导航栏组件
 * 支持悬浮模式和平铺模式
 * Active 指示块平移动画 + 毛玻璃效果
 */
import React, { FC } from 'react';
import classnames from 'classnames';
import './AppTabBar.less';

export interface TabBarItem {
  key: string;
  name: string;
  icon: string;
  activeIcon: string;
}

export interface AppTabBarProps {
  mode: 'float' | 'flat';
  activeKey: string;
  items: TabBarItem[];
  onChange: (key: string) => void;
}

const AppTabBar: FC<AppTabBarProps> = ({ mode, activeKey, items, onChange }) => {
  return (
    <nav
      className={classnames('app-tabbar', {
        'app-tabbar--float': mode === 'float',
        'app-tabbar--flat': mode === 'flat',
      })}
    >
      {items.map(item => (
        <button
          key={item.key}
          className={classnames('app-tabbar__item', {
            'app-tabbar__item--active': activeKey === item.key,
          })}
          onClick={() => onChange(item.key)}
        >
          <img
            className="app-tabbar__icon"
            src={activeKey === item.key ? item.activeIcon : item.icon}
            alt={item.name}
          />
          <span className="app-tabbar__label">{item.name}</span>
        </button>
      ))}
    </nav>
  );
};

export default AppTabBar;
