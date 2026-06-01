/**
 * 签到接口
 *
 * - GET /api/sign/status：查询签到状态（含连签天数、当月日历）
 * - POST /api/sign：执行签到，必传 Idempotency-Key
 *
 * 后端返回字段适配器（后端字段名 → 前端类型 SignStatus / SignResult）
 *   getSignStatus: todaySigned→signedToday, currentStreak→continuousDays
 *   doSign:          points→pointsAwarded, streak→continuousDays
 *
 * 后端限流：10 次/分钟（router.ts:396）
 *
 * Plan: Task 1.4 / Bugfix 2026-06-01
 */
import { request } from '@/utils';
import type { ApiResult } from '../types/auth';
import type { SignStatus, SignResult } from '../types/points';

/** 生成本周日历（周一~周日） */
const buildWeekCalendar = (
  signedDates: string[],
): Array<{ date: string; signed: boolean }> => {
  const signedSet = new Set(signedDates);
  const today = new Date();
  const day = today.getDay(); // 0=Sun
  const monday = new Date(today);
  monday.setDate(today.getDate() - (day === 0 ? 6 : day - 1));
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    const dateStr = d.toISOString().slice(0, 10);
    return { date: dateStr, signed: signedSet.has(dateStr) };
  });
};

export const getSignStatus = async (): Promise<ApiResult<SignStatus>> => {
  const res: any = await request.get('/api/sign/status');
  if (res?.code === 200 && res.data) {
    const d: any = res.data;
    // 适配后端字段名 → 前端 SignStatus
    const adapted: SignStatus = {
      signedToday: !!d.todaySigned,
      continuousDays: d.currentStreak ?? 0,
      totalDays: d.totalSignDays ?? 0,
      weekCalendar: buildWeekCalendar(d.signedDates || []),
    };
    return { code: 200, data: adapted, message: res.message };
  }
  return res;
};

export const doSign = async (
  idemKey: string,
): Promise<ApiResult<SignResult>> => {
  const res: any = await request.post('/api/sign', {
    data: {},
    headers: { 'Idempotency-Key': idemKey },
  });
  if (res?.code === 200 && res.data) {
    const d: any = res.data;
    // 适配后端字段名 → 前端 SignResult
    const adapted: SignResult = {
      pointsAwarded: d.points ?? 0,
      growthAwarded: d.growth ?? 0,
      continuousDays: d.streak ?? 0,
    };
    return { code: 200, data: adapted, message: res.message };
  }
  return res;
};
