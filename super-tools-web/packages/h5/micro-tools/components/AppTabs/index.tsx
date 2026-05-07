/**
 * AppTabs Tab 切换组件
 * 支持双 Tab 模式和多 Tab 模式
 * Active 指示块平移动画 + 内容区滑动切换
 */
import React, { FC, useRef, useEffect, useCallback } from 'react';
import classnames from 'classnames';
import './AppTabs.less';

export interface TabItem {
  key: string;
  name: string;
  icon?: string;
}

export interface AppTabsProps {
  mode: 'double' | 'multiple';
  tabs: TabItem[];
  activeIndex: number;
  onChange: (index: number) => void;
}

const AppTabs: FC<AppTabsProps> = ({ mode, tabs, activeIndex, onChange }) => {
  const tabRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);

  // 多 Tab 模式下自动滚动居中
  const scrollToCenter = useCallback(() => {
    if (mode !== 'multiple' || !tabRef.current || !itemRefs.current[activeIndex]) return;
    const container = tabRef.current;
    const item = itemRefs.current[activeIndex];
    const containerRect = container.getBoundingClientRect();
    const itemRect = item.getBoundingClientRect();
    const scrollLeft =
      item.offsetLeft - container.offsetWidth / 2 + item.offsetWidth / 2;
    container.scrollTo({ left: scrollLeft, behavior: 'smooth' });
  }, [mode, activeIndex]);

  useEffect(() => {
    scrollToCenter();
  }, [scrollToCenter]);

  return (
    <div className={classnames('app-tabs', `app-tabs--${mode}`)}>
      {mode === 'double' ? (
        <div className="app-tabs__double-track">
          <div
            className="app-tabs__double-indicator"
            style={{ transform: `translateX(${activeIndex * 100}%)` }}
          />
          {tabs.map((tab, idx) => (
            <div
              key={tab.key}
              className={classnames('app-tabs__double-item', {
                'app-tabs__double-item--active': idx === activeIndex,
              })}
              onClick={() => onChange(idx)}
            >
              {tab.name}
            </div>
          ))}
        </div>
      ) : (
        <div className="app-tabs__multiple-track" ref={tabRef}>
          {tabs.map((tab, idx) => (
            <div
              key={tab.key}
              ref={el => { itemRefs.current[idx] = el; }}
              className={classnames('app-tabs__multiple-item', {
                'app-tabs__multiple-item--active': idx === activeIndex,
              })}
              onClick={() => onChange(idx)}
            >
              {tab.icon && <img className="app-tabs__icon" src={tab.icon} alt={tab.name} />}
              <span>{tab.name}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AppTabs;
