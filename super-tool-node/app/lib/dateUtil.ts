/**
 * 时区相关工具
 *  设计依据: docs/superpowers/specs/2026-05-27-积分成长体系后端优化设计文档.md §2.2-#8
 *  实施计划: docs/superpowers/plans/2026-05-27-积分成长体系后端优化-A基础设施实施计划.md Task A2
 *
 *  核心动机：业务面向 Asia/Shanghai 用户，禁止依赖 server 时区。
 *
 *  使用方式：
 *    import { localTodayStr, prevDayStr, formatLocalDateTime, localYearMonthStr } from '../lib/dateUtil';
 *    const today = localTodayStr();   // '2026-05-27'（北京时间）
 *
 *  实现策略：
 *    - localTodayStr / formatLocalDateTime：用 toLocaleString('en-US', { timeZone })
 *      把任意 Date 转换到"北京时间视图"再格式化；不依赖 process.env.TZ。
 *    - prevDayStr：纯字符串解析 + UTC 整数运算，避免 Date 对象在不同 server 时区下的
 *      month/day 边界漂移；输入输出都是 'YYYY-MM-DD'。
 */

const TIMEZONE = 'Asia/Shanghai';

const pad2 = (n: number): string => String(n).padStart(2, '0');

/**
 * 把 Date 转成「北京时间视图」的 Date：
 *   返回的对象上 getFullYear/getMonth/getDate/getHours 等读到的就是北京时间数值
 *
 *  注：这是为了在不依赖 server 时区的前提下取北京时间各字段而做的「视图」转换，
 *      返回的 Date 不应再用于时间戳运算（其内部时间戳是 server 时区误读后的产物）。
 */
function toLocalView(d: Date = new Date()): Date {
  return new Date(d.toLocaleString('en-US', { timeZone: TIMEZONE }));
}

/** 北京时间「今天」（YYYY-MM-DD） */
export function localTodayStr(d: Date = new Date()): string {
  const v = toLocalView(d);
  return `${v.getFullYear()}-${pad2(v.getMonth() + 1)}-${pad2(v.getDate())}`;
}

/**
 * 给定 'YYYY-MM-DD' 的前一天
 *  使用 UTC 整数运算，避免 server 时区影响 month/day 边界。
 */
export function prevDayStr(dateStr: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr);
  if (!m) throw new Error(`prevDayStr: invalid dateStr=${dateStr}`);
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  // 用 UTC 计算前一天：UTC 下 day 边界与人类直觉一致，且与 server 时区无关
  const ts = Date.UTC(y, mo - 1, d) - 86_400_000;
  const x = new Date(ts);
  return `${x.getUTCFullYear()}-${pad2(x.getUTCMonth() + 1)}-${pad2(x.getUTCDate())}`;
}

/** 北京时间「YYYY-MM-DD HH:mm:ss」（用于 SQL DATETIME 字符串） */
export function formatLocalDateTime(d: Date = new Date()): string {
  const v = toLocalView(d);
  return (
    `${v.getFullYear()}-${pad2(v.getMonth() + 1)}-${pad2(v.getDate())} ` +
    `${pad2(v.getHours())}:${pad2(v.getMinutes())}:${pad2(v.getSeconds())}`
  );
}

/** 北京时间「YYYY-MM」（用于按月查询，如签到日历） */
export function localYearMonthStr(d: Date = new Date()): string {
  return localTodayStr(d).slice(0, 7);
}

/** 北京时间「YYYY」（用于年度任务周期键） */
export function localYearStr(d: Date = new Date()): string {
  return localTodayStr(d).slice(0, 4);
}

/**
 * 北京时间 ISO 周键「YYYY-Www」
 *  - 用 ISO 8601：周一为一周第一天，含本年第一个周四的那一周为第 1 周
 *  - 注意 ISO 周年（weekYear）跨年时与日历年不同，例如 2026-01-01 (周四) 属 2026-W01；
 *    但 2024-12-30 (周一) 属 2025-W01，所以年份必须用「ISO 周年」而非日历年。
 */
export function localIsoWeekStr(d: Date = new Date()): string {
  const v = toLocalView(d);
  // 用 UTC 整数运算，避免 Date 对象再次被 server 时区干扰
  const tmp = new Date(Date.UTC(v.getFullYear(), v.getMonth(), v.getDate()));
  // ISO: 周一=1 ... 周日=7
  const dayNum = tmp.getUTCDay() || 7;
  // 移到当周的周四（同 ISO 周年的代表日）
  tmp.setUTCDate(tmp.getUTCDate() + 4 - dayNum);
  const weekYear = tmp.getUTCFullYear();
  // 当年 1 月 1 日
  const yearStart = new Date(Date.UTC(weekYear, 0, 1));
  const weekNum = Math.ceil(((tmp.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
  return `${weekYear}-W${pad2(weekNum)}`;
}
