/**
 * useSwipe - 通用左右滑动手势 Hook
 *
 * 支持：
 * - 左右滑动方向识别
 * - 实时拖拽偏移量（用于跟手动画）
 * - 滑动阈值 & 速度阈值判定
 * - 防止垂直滚动时误触发
 */
import { useRef, useCallback } from 'react';

export interface UseSwipeOptions {
  /** 触发切换的最小水平距离（px），默认 50 */
  threshold?: number;
  /** 触发切换的最小速度（px/ms），达到速度阈值时即使距离不够也可切换，默认 0.3 */
  velocityThreshold?: number;
  /** 滑动方向锁定角度：水平/垂直方向偏移的 tan 值阈值，默认 0.577（约 30°），越小越严格 */
  directionLockRatio?: number;
  /** 向左滑动回调（切换到下一个 Tab） */
  onSwipeLeft?: () => void;
  /** 向右滑动回调（切换到上一个 Tab） */
  onSwipeRight?: () => void;
  /** 实时偏移回调（用于跟手动画），参数为当前水平偏移 px */
  onSwiping?: (offsetX: number) => void;
  /** 滑动结束回调（取消或完成切换后重置） */
  onSwipeEnd?: () => void;
}

export function useSwipe(options: UseSwipeOptions = {}) {
  const {
    threshold = 50,
    velocityThreshold = 0.3,
    directionLockRatio = 0.577,
    onSwipeLeft,
    onSwipeRight,
    onSwiping,
    onSwipeEnd,
  } = options;

  /** 是否已锁定为水平方向 */
  const directionLocked = useRef<'horizontal' | 'vertical' | null>(null);
  const startX = useRef(0);
  const startY = useRef(0);
  const startTime = useRef(0);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    startX.current = touch.clientX;
    startY.current = touch.clientY;
    startTime.current = Date.now();
    directionLocked.current = null;
  }, []);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    const dx = touch.clientX - startX.current;
    const dy = touch.clientY - startY.current;

    // 方向锁定：首次移动超过 5px 时判定方向
    if (!directionLocked.current) {
      const absDx = Math.abs(dx);
      const absDy = Math.abs(dy);
      if (absDx < 5 && absDy < 5) return; // 距离太小，还不能判定
      if (absDy > 0 && absDx / absDy < directionLockRatio) {
        directionLocked.current = 'vertical';
        return;
      }
      directionLocked.current = 'horizontal';
    }

    if (directionLocked.current === 'vertical') return;

    // 水平滑动时，报告实时偏移
    onSwiping?.(dx);
  }, [directionLockRatio, onSwiping]);

  const onTouchEnd = useCallback((e: React.TouchEvent) => {
    if (directionLocked.current !== 'horizontal') {
      directionLocked.current = null;
      onSwipeEnd?.();
      return;
    }

    const touch = e.changedTouches[0];
    const dx = touch.clientX - startX.current;
    const elapsed = Date.now() - startTime.current;
    const velocity = Math.abs(dx) / (elapsed || 1);

    const triggered = Math.abs(dx) > threshold || velocity > velocityThreshold;

    if (triggered) {
      if (dx < 0) {
        onSwipeLeft?.();
      } else {
        onSwipeRight?.();
      }
    }

    directionLocked.current = null;
    onSwipeEnd?.();
  }, [threshold, velocityThreshold, onSwipeLeft, onSwipeRight, onSwipeEnd]);

  return {
    onTouchStart,
    onTouchMove,
    onTouchEnd,
  };
}
