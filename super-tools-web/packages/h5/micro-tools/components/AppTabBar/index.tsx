import { resolveIcon } from '../../utils/icon';
/**
 * AppTabBar 底部导航栏组件
 *
 * 关键能力：
 *   - 默认根据当前路由 (useLocation) 自动推导 active key，调用方无需再传 activeKey
 *   - 调用方可显式传入 activeKey 覆盖派生结果（特殊场景，如临时高亮）
 *   - 默认 onChange 行为：safeNavigate 到 tab 对应的路由（'/' / '/{key}'）
 *
 * 这样可以避免 store 中的 activeTabBarKey 与 location.pathname 不一致
 * （例如：从 featured → 二级页 → /404 → 返回首页 后，原方案 active 仍然停留在 featured）
 *
 * 图标渲染：
 *   - inactive：保持原样使用 <img> 渲染 item.icon（原始多色/灰度图）
 *   - active：使用 HexColorIcon 对 item.icon 进行 themeColor 染色，省去单独的 activeIcon 资源
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import React, { FC, useMemo } from 'react';
import classnames from 'classnames';
import { useLocation } from 'umi';
import { safeNavigate } from '../../utils/safeNavigate';
import { useGlobalStore } from '../../store';
import HexColorIcon from '../HexColorIcon';
import './AppTabBar.less';

export interface TabBarItem {
  key: string;
  name: string;
  icon: string;
}

export interface AppTabBarProps {
  mode: 'float' | 'flat';
  items: TabBarItem[];
  /** 可选：显式覆盖派生出的 active key */
  activeKey?: string;
  /** 可选：自定义点击处理；未传则走 safeNavigate 默认跳转 */
  onChange?: (key: string) => void;
}

/**
 * 根据 pathname 推导出当前应高亮的 tab key。
 *
 * 规则：
 *   1. '/' → 'home'
 *   2. 在 items 中找出 path === '/{key}' 完全匹配
 *   3. 在 items 中找出 pathname 以 '/{key}' 开头（覆盖未来的 /favorites/xxx 等子路由）
 *   4. 都不命中 → 返回空串（视觉上无 active，符合\"二级页面无所属 tab\"的语义）
 */
function deriveActiveKey(pathname: string, items: TabBarItem[]): string {
  if (!pathname) return '';
  if (pathname === '/' || pathname === '') return 'home';

  // 完全匹配 '/{key}'
  const exact = items.find((i) => `/${i.key}` === pathname);
  if (exact) return exact.key;

  // 前缀匹配 '/{key}/...'
  const prefix = items.find((i) => i.key !== 'home' && pathname.startsWith(`/${i.key}/`));
  if (prefix) return prefix.key;

  return '';
}

const AppTabBar: FC<AppTabBarProps> = ({ mode, activeKey, items, onChange }) => {
  const { pathname } = useLocation();
  const themeColor = useGlobalStore(s => s.themeColor);

  const derivedKey = useMemo(() => deriveActiveKey(pathname, items), [pathname, items]);
  const finalActiveKey = activeKey ?? derivedKey;

  const handleClick = (key: string) => {
    if (onChange) {
      onChange(key);
      return;
    }
    // 默认行为：跳到 tab 对应路由
    safeNavigate(key === 'home' ? '/' : `/${key}`);
  };

  return (
    <nav
      className={classnames('app-tabbar', {
        'app-tabbar--float': mode === 'float',
        'app-tabbar--flat': mode === 'flat',
      })}
    >
      {items.map(item => {
        const isActive = finalActiveKey === item.key;
        const iconSrc = resolveIcon(item.icon);
        return (
          <button
            key={item.key}
            className={classnames('app-tabbar__item', {
              'app-tabbar__item--active': isActive,
            })}
            onClick={() => handleClick(item.key)}
          >
            {isActive ? (
              <HexColorIcon
                className="app-tabbar__icon"
                src={iconSrc}
                color={themeColor}
                alt={item.name}
              />
            ) : (
              <img
                className="app-tabbar__icon"
                src={iconSrc}
                alt={item.name}
              />
            )}
            <span className="app-tabbar__label">{item.name}</span>
          </button>
        );
      })}
    </nav>
  );
};

export default AppTabBar;
