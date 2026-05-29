/**
 * 倒计时组件
 * Plan: Task 5.1
 */
import React, { FC, useEffect, useState } from 'react';
import './Countdown.less';

export interface CountdownProps {
  endAt: string;
  onFinish?: () => void;
  prefix?: string;
}

const pad = (n: number) => String(n).padStart(2, '0');

const Countdown: FC<CountdownProps> = ({ endAt, onFinish, prefix }) => {
  const [remaining, setRemaining] = useState(() =>
    Math.max(0, new Date(endAt).getTime() - Date.now()),
  );

  useEffect(() => {
    if (remaining <= 0) { onFinish?.(); return; }
    const timer = setInterval(() => {
      setRemaining((prev) => {
        const next = Math.max(0, prev - 1000);
        if (next === 0) { clearInterval(timer); onFinish?.(); }
        return next;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [endAt]); // eslint-disable-line react-hooks/exhaustive-deps

  if (remaining <= 0) return <span className="countdown is-finished">已结束</span>;

  const totalSec = Math.floor(remaining / 1000);
  const days = Math.floor(totalSec / 86400);
  const hours = Math.floor((totalSec % 86400) / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const seconds = totalSec % 60;

  return (
    <span className="countdown">
      {prefix && <span className="countdown__prefix">{prefix} </span>}
      {days > 0 && <span className="countdown__seg">{days}天</span>}
      <span className="countdown__seg">{pad(hours)}</span>:
      <span className="countdown__seg">{pad(minutes)}</span>:
      <span className="countdown__seg">{pad(seconds)}</span>
    </span>
  );
};

export default Countdown;
