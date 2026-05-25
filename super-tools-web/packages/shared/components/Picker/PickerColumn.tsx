import React, { CSSProperties, HTMLProps, createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { usePickerActions, usePickerData } from './Picker';

interface PickerColumnProps extends HTMLProps<HTMLDivElement> {
  name: string
}

const PickerColumnDataContext = createContext<{
  key: string
} | null>(null);
PickerColumnDataContext.displayName = 'PickerColumnDataContext';

export function useColumnData(componentName: string) {
  const context = useContext(PickerColumnDataContext);
  if (context === null) {
    const error = new Error(`<${componentName} /> is missing a parent <Picker.Column /> component.`);
    if (Error.captureStackTrace) {
      Error.captureStackTrace(error, useColumnData);
    }
    throw error;
  }
  return context;
}

function PickerColumn({
  style,
  children,
  name: key,
  ...restProps
}: PickerColumnProps) {
  const { height, itemHeight, wheelMode, value: groupValue, optionGroups } = usePickerData('Picker.Column');

  // 计算选中的值
  const value = useMemo(
    () => groupValue[key],
    [groupValue, key],
  );
  const options = useMemo(
    () => optionGroups[key] || [],
    [key, optionGroups],
  );
  const selectedIndex = useMemo(
    () => {
      let index = options.findIndex(o => o.value === value);
      if (index < 0) {
        index = 0;
      }
      return index;
    },
    [options, value],
  );

  const minTranslate = useMemo(
    () => height / 2 - itemHeight * options.length + itemHeight / 2,
    [height, itemHeight, options],
  );
  const maxTranslate = useMemo(
    () => height / 2 - itemHeight / 2,
    [height, itemHeight],
  );
  const [scrollerTranslate, setScrollerTranslate] = useState<number>(
    () => height / 2 - itemHeight / 2 - 0 * itemHeight, // 初始按 selectedIndex=0 计算，下面 layoutEffect 会立刻校正
  );
  // 改用 useLayoutEffect：在浏览器 paint 之前同步设置正确 translate，
  // 避免组件首次挂载时出现"从 0 滑动到正确位置"的 300ms 过渡（表现为列表初始空白）
  useLayoutEffect(() => {
    setScrollerTranslate(height / 2 - itemHeight / 2 - selectedIndex * itemHeight);
  }, [height, itemHeight, selectedIndex]);

  const pickerActions = usePickerActions('Picker.Column');
  const translateRef = useRef<number>(scrollerTranslate);
  translateRef.current = scrollerTranslate;
  const handleScrollerTranslateSettled = useCallback(() => {
    let nextActiveIndex = 0;
    const currentTrans = translateRef.current;
    if (currentTrans >= maxTranslate) {
      nextActiveIndex = 0;
    } else if (currentTrans <= minTranslate) {
      nextActiveIndex = options.length - 1;
    } else {
      nextActiveIndex = -Math.round((currentTrans - maxTranslate) / itemHeight);
    }

    const changed = pickerActions.change(key, options[nextActiveIndex].value);
    if (!changed) {
      setScrollerTranslate(height / 2 - itemHeight / 2 - nextActiveIndex * itemHeight);
    }
  }, [pickerActions, height, itemHeight, key, maxTranslate, minTranslate, options]);

  // touch事件
  const [startScrollerTranslate, setStartScrollerTranslate] = useState<number>(0);
  const [isMoving, setIsMoving] = useState<boolean>(false);
  const [startTouchY, setStartTouchY] = useState<number>(0);

  const updateScrollerWhileMoving = useCallback((nextScrollerTranslate: number) => {
    if (nextScrollerTranslate < minTranslate) {
      nextScrollerTranslate = minTranslate - Math.pow(minTranslate - nextScrollerTranslate, 0.8);
    } else if (nextScrollerTranslate > maxTranslate) {
      nextScrollerTranslate = maxTranslate + Math.pow(nextScrollerTranslate - maxTranslate, 0.8);
    }
    setScrollerTranslate(nextScrollerTranslate);
  }, [maxTranslate, minTranslate]);

  const handleTouchStart = useCallback((event: React.TouchEvent) => {
    setStartTouchY(event.targetTouches[0].pageY);
    setStartScrollerTranslate(scrollerTranslate);
  }, [scrollerTranslate]);

  const handleTouchMove = useCallback((event: TouchEvent) => {
    if (event.cancelable) {
      event.preventDefault();
    }

    if (!isMoving) {
      setIsMoving(true);
    }

    const nextScrollerTranslate = startScrollerTranslate + event.targetTouches[0].pageY - startTouchY;
    updateScrollerWhileMoving(nextScrollerTranslate);
  }, [isMoving, startScrollerTranslate, startTouchY, updateScrollerWhileMoving]);

  const handleTouchEnd = useCallback(() => {
    if (!isMoving) {
      return;
    }
    setIsMoving(false);
    setStartTouchY(0);
    setStartScrollerTranslate(0);

    handleScrollerTranslateSettled();
  }, [handleScrollerTranslateSettled, isMoving]);

  const handleTouchCancel = useCallback(() => {
    if (!isMoving) {
      return;
    }
    setIsMoving(false);
    setStartTouchY(0);
    setScrollerTranslate(startScrollerTranslate);
    setStartScrollerTranslate(0);
  }, [isMoving, startScrollerTranslate]);

  // 滚动事件
  const wheelingTimer = useRef<number | null>(null);

  const handleWheeling = useCallback((event: WheelEvent) => {
    if (event.deltaY === 0) {
      return;
    }
    let delta = event.deltaY * 0.1;
    if (Math.abs(delta) < itemHeight) {
      delta = itemHeight * Math.sign(delta);
    }
    if (wheelMode === 'normal') {
      delta = -delta;
    }

    const nextScrollerTranslate = scrollerTranslate + delta;
    updateScrollerWhileMoving(nextScrollerTranslate);
  }, [itemHeight, scrollerTranslate, updateScrollerWhileMoving, wheelMode]);

  const handleWheelEnd = useCallback(() => {
    handleScrollerTranslateSettled();
  }, [handleScrollerTranslateSettled]);

  const handleWheel = useCallback((event: WheelEvent) => {
    if (wheelMode === 'off') {
      return;
    }

    if (event.cancelable) {
      event.preventDefault();
    }

    handleWheeling(event);

    if (wheelingTimer.current) {
      clearTimeout(wheelingTimer.current);
    }

    wheelingTimer.current = setTimeout(() => {
      handleWheelEnd();
    }, 200) as unknown as number;
  }, [handleWheelEnd, handleWheeling, wheelingTimer, wheelMode]);

  const containerRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const container = containerRef.current;
    if (container) {
      container.addEventListener('touchmove', handleTouchMove, { passive: false });
      container.addEventListener('wheel', handleWheel, { passive: false });
    }
    return () => {
      if (container) {
        container.removeEventListener('touchmove', handleTouchMove);
        container.removeEventListener('wheel', handleWheel);
      }
    };
  }, [handleTouchMove, handleWheel]);

  const columnStyle = useMemo<CSSProperties>(
    () => ({
      flex: '1 1 0%',
      maxHeight: '100%',
      transitionProperty: 'transform',
      transitionTimingFunction: 'cubic-bezier(0, 0, 0.2, 1)',
      transitionDuration: isMoving ? '0ms' : '300ms',
      transform: `translate3d(0, ${scrollerTranslate}px, 0)`,
    }),
    [scrollerTranslate, isMoving],
  );

  const columnData = useMemo(
    () => ({ key }),
    [key],
  );

  return (
    <div
      style={{
        ...columnStyle,
        ...style,
      }}
      ref={containerRef}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchCancel}
      {...restProps}
    >
      <PickerColumnDataContext.Provider value={columnData}>
        {children}
      </PickerColumnDataContext.Provider>
    </div>
  );
}


export default PickerColumn;
