/**
 * 签到日历周视图
 *
 * - 显示本周 7 天的签到状态
 * - 显示连签天数 + 距下一里程碑天数
 * - 含签到按钮
 *
 * Plan: Task 4.1
 */
import React, { FC } from 'react';
import './SignCalendar.less';

export interface SignCalendarProps {
  weekData: Array<{ date: string; signed: boolean }>;
  continuousDays: number;
  onSign?: () => void;
  signedToday?: boolean;
  submitting?: boolean;
}

const WEEK_DAYS = ['一', '二', '三', '四', '五', '六', '日'];
const MILESTONES = [7, 30, 100, 365];

const SignCalendar: FC<SignCalendarProps> = ({
  weekData,
  continuousDays,
  onSign,
  signedToday,
  submitting,
}) => {
  const todayStr = new Date().toISOString().slice(0, 10);
  const nextMilestone = MILESTONES.find((m) => m > continuousDays);
  const remainToMilestone = nextMilestone
    ? nextMilestone - continuousDays
    : 0;

  const data =
    weekData && weekData.length === 7
      ? weekData
      : WEEK_DAYS.map(() => ({ date: '', signed: false }));

  return (
    <div className="sign-calendar">
      <div className="sign-calendar__row sign-calendar__row--head">
        {WEEK_DAYS.map((d) => (
          <div key={d} className="sign-calendar__cell">
            {d}
          </div>
        ))}
      </div>
      <div className="sign-calendar__row">
        {data.map((d, i) => {
          const isToday = d.date === todayStr;
          return (
            <div
              key={i}
              className={`sign-calendar__cell${d.signed ? ' is-signed' : ''}${
                isToday ? ' is-today' : ''
              }`}
            >
              {d.signed ? '✅' : isToday ? '今' : '·'}
            </div>
          );
        })}
      </div>
      <div className="sign-calendar__info">
        <span>
          已连续签到 <strong>{continuousDays}</strong> 天
        </span>
        {nextMilestone && (
          <span className="sign-calendar__milestone">
            距连续 {nextMilestone} 天奖励还差 {remainToMilestone} 天
          </span>
        )}
      </div>
      {onSign && (
        <button
          className="sign-calendar__btn"
          disabled={signedToday || submitting}
          onClick={onSign}
        >
          {submitting
            ? '签到中...'
            : signedToday
              ? '今日已签到'
              : '立即签到'}
        </button>
      )}
    </div>
  );
};

export default SignCalendar;
