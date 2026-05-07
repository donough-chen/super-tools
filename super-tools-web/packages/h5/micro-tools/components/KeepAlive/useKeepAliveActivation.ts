/**
 * useKeepAliveActivation Hook
 *
 * 提供页面激活/休眠的生命周期回调
 * 在需要缓存的页面中使用，替代 useEffect 中的初始化逻辑
 *
 * 用法示例：
 * ```tsx
 * useKeepAliveActivation({
 *   onActivate: () => {
 *     console.log('页面被激活（从缓存恢复或首次进入）');
 *     // 可以在此刷新数据、恢复滚动位置等
 *   },
 *   onDeactivate: () => {
 *     console.log('页面被休眠（切走但保持缓存）');
 *     // 可以在此保存临时状态
 *   },
 * });
 * ```
 */
import { useEffect, useRef } from 'react';

interface UseKeepAliveActivationOptions {
  /** 页面激活时回调（首次进入 + 每次从后台恢复） */
  onActivate?: () => void;
  /** 页面休眠时回调（被缓存隐藏时） */
  onDeactivate?: () => void;
}

export const useKeepAliveActivation = ({
  onActivate,
  onDeactivate,
}: UseKeepAliveActivationOptions) => {
  const activateRef = useRef(onActivate);
  const deactivateRef = useRef(onDeactivate);

  // 保持回调引用最新
  activateRef.current = onActivate;
  deactivateRef.current = onDeactivate;

  useEffect(() => {
    // 组件挂载时视为激活
    activateRef.current?.();

    return () => {
      // 组件隐藏时（被 display:none 不会触发卸载）
      // 此 hook 主要配合 KeepAlive 的 onActivate/onDeactivate 回调使用
      deactivateRef.current?.();
    };
  }, []);
};

export default useKeepAliveActivation;
