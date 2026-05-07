import { useEffect, useState, useRef, useCallback } from 'react';

/**
 * 通用倒计时 Hook
 * @param endsAt 截止时间戳（ms），≤ Date.now() 表示未启动或已结束
 * @returns remainingSeconds（每秒自动 -1，0 表示结束）
 */
export const useCountdown = (endsAt: number) => {
  const [remaining, setRemaining] = useState(() => Math.max(0, Math.ceil((endsAt - Date.now()) / 1000)));
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const tick = useCallback(() => {
    const r = Math.max(0, Math.ceil((endsAt - Date.now()) / 1000));
    setRemaining(r);
    if (r === 0 && timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, [endsAt]);

  useEffect(() => {
    tick(); // 立即同步
    if (endsAt > Date.now()) {
      timerRef.current = setInterval(tick, 1000);
    }
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [endsAt, tick]);

  return remaining;
};
