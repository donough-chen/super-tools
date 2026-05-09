/**
 * 组件统一出口
 */
export { default as AppHeader } from './AppHeader';
export { default as AppTabs } from './AppTabs';
export { default as AppTabBar } from './AppTabBar';
export { default as AppModal } from './AppModal';
export { default as KeepAlive } from './KeepAlive';
export { default as CacheRoute, CACHE_ROUTES } from './KeepAlive/CacheRoute';
export { useKeepAlive, KeepAliveContext } from './KeepAlive';
export { useKeepAliveActivation } from './KeepAlive/useKeepAliveActivation';
export { default as SendCodeButton } from './SendCodeButton';
export { default as Switch } from './Switch';
export { default as ToolActionPopup } from './ToolActionPopup';

export type { AppHeaderProps, HeaderButtonConfig } from './AppHeader';
export type { AppTabsProps, TabItem } from './AppTabs';
export type { AppTabBarProps, TabBarItem } from './AppTabBar';
export type { AppModalProps, ModalContentType } from './AppModal';
export type { KeepAliveContextValue, KeepAliveProps, CacheEntry } from './KeepAlive';
export type { SendCodeButtonProps } from './SendCodeButton';
export type { SwitchProps } from './Switch';
export type { ToolActionPopupProps, ToolActionItem } from './ToolActionPopup';
