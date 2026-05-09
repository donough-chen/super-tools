/**
 * useLongPress - 通用长按手势 Hook
 *
 * 行为：
 *  - 在元素上按下后超过 `delay` 毫秒内手指/鼠标未显著移动，则触发 onLongPress
 *  - 触发后若 `suppressClickAfter=true`，本次 touch/click 不会冒泡为普通点击
 *  - 移动超过 `moveThreshold` 像素则取消长按（用户正在滑动列表）
 *
 * 典型用法：
 *
 *   const bind = useLongPress({
 *     onLongPress: () => showActionMenu(item),
 *     delay: 500,
 *   });
 *   <div {...bind}>...</div>
 */
import { useRef, useCallback } from 'react';

export interface UseLongPressOptions {
  /** 长按触发回调 */
  onLongPress: (e: React.TouchEvent | React.MouseEvent) => void;
  /** 普通点击回调（未达到长按阈值） */
  onClick?: (e: React.TouchEvent | React.MouseEvent) => void;
  /** 长按阈值（ms），默认 500 */
  delay?: number;
  /** 允许的抖动距离（px），超过则取消长按，默认 10 */
  moveThreshold?: number;
  /**
   * 长按触发后是否抑制随后的 click 冒泡。
   * true 时阻止 touchend 后的 click 事件（iOS 需要特殊处理）
   * 默认 true
   */
  suppressClickAfter?: boolean;
  /** 是否禁用，默认 false */
  disabled?: boolean;
}

/** 长按手势返回的绑定 handlers */
export interface LongPressBind {
  onTouchStart: (e: React.TouchEvent) => void;
  onTouchMove: (e: React.TouchEvent) => void;
  onTouchEnd: (e: React.TouchEvent) => void;
  onTouchCancel: (e: React.TouchEvent) => void;
  onMouseDown: (e: React.MouseEvent) => void;
  onMouseMove: (e: React.MouseEvent) => void;
  onMouseUp: (e: React.MouseEvent) => void;
  onMouseLeave: (e: React.MouseEvent) => void;
  onClick: (e: React.MouseEvent) => void;
  onContextMenu: (e: React.MouseEvent) => void;
}

export function useLongPress(options: UseLongPressOptions): LongPressBind {
  const {
    onLongPress,
    onClick,
    delay = 500,
    moveThreshold = 10,
    suppressClickAfter = true,
    disabled = false,
  } = options;

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startPosRef = useRef<{ x: number; y: number } | null>(null);
  /** 标记本次按压是否已触发长按（用于在 click 时抑制） */
  const triggeredRef = useRef(false);
  /** 标记是否处于「按下」状态（鼠标/触摸按下后） */
  const pressingRef = useRef(false);

  const clear = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const handleStart = useCallback(
    (x: number, y: number, e: React.TouchEvent | React.MouseEvent) => {
      if (disabled) return;
      startPosRef.current = { x, y };
      triggeredRef.current = false;
      pressingRef.current = true;
      clear();
      timerRef.current = setTimeout(() => {
        if (pressingRef.current) {
          triggeredRef.current = true;
          onLongPress(e);
        }
      }, delay);
    },
    [disabled, delay, onLongPress, clear],
  );

  const handleMove = useCallback(
    (x: number, y: number) => {
      if (!startPosRef.current) return;
      const dx = x - startPosRef.current.x;
      const dy = y - startPosRef.current.y;
      if (Math.abs(dx) > moveThreshold || Math.abs(dy) > moveThreshold) {
        clear();
        pressingRef.current = false;
      }
    },
    [moveThreshold, clear],
  );

  const handleEnd = useCallback(() => {
    clear();
    pressingRef.current = false;
    startPosRef.current = null;
  }, [clear]);

  const onTouchStart = useCallback(
    (e: React.TouchEvent) => {
      const t = e.touches[0];
      handleStart(t.clientX, t.clientY, e);
    },
    [handleStart],
  );

  const onTouchMove = useCallback(
    (e: React.TouchEvent) => {
      const t = e.touches[0];
      handleMove(t.clientX, t.clientY);
    },
    [handleMove],
  );

  const onTouchEnd = useCallback(
    (_e: React.TouchEvent) => {
      handleEnd();
      /**
       * 这里绝对不能调用 e.preventDefault()。
       *
       * 原因：长按已触发（triggeredRef=true）时，若用户按住 item 直接滑到
       * 浮层按钮再松开，touchend 会冒泡到此 handler。若此处 preventDefault，
       * 浏览器会**取消本次触摸序列后续的所有合成事件**（包括浮层按钮上的 click、
       * mouseup、甚至 :active 伪类反馈），表现为「按钮点了没反应、没高亮」。
       *
       * 抑制 item 自身 click 改由 onClickHandler 里的 stopPropagation 处理。
       */
    },
    [handleEnd],
  );

  const onTouchCancel = useCallback(() => {
    handleEnd();
  }, [handleEnd]);

  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      // 鼠标仅左键触发
      if (e.button !== 0) return;
      handleStart(e.clientX, e.clientY, e);
    },
    [handleStart],
  );

  const onMouseMove = useCallback(
    (e: React.MouseEvent) => {
      handleMove(e.clientX, e.clientY);
    },
    [handleMove],
  );

  const onMouseUp = useCallback(() => {
    handleEnd();
  }, [handleEnd]);

  const onMouseLeave = useCallback(() => {
    handleEnd();
  }, [handleEnd]);

  const onClickHandler = useCallback(
    (e: React.MouseEvent) => {
      if (triggeredRef.current) {
        // 长按已触发，抑制 click
        triggeredRef.current = false;
        if (suppressClickAfter) {
          e.preventDefault();
          e.stopPropagation();
        }
        return;
      }
      onClick?.(e);
    },
    [onClick, suppressClickAfter],
  );

  /** 屏蔽桌面浏览器右键菜单，否则长按会被系统菜单打断 */
  const onContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
  }, []);

  return {
    onTouchStart,
    onTouchMove,
    onTouchEnd,
    onTouchCancel,
    onMouseDown,
    onMouseMove,
    onMouseUp,
    onMouseLeave,
    onClick: onClickHandler,
    onContextMenu,
  };
}
