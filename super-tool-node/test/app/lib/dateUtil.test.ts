/**
 * dateUtil 单元测试
 *  对应 plan: docs/superpowers/plans/2026-05-27-积分成长体系后端优化-A基础设施实施计划.md Task A2
 *
 *  关键断言：所有日期计算固定按 Asia/Shanghai 时区执行，
 *           不依赖 server 进程的 process.env.TZ。
 */
import {
  localTodayStr,
  prevDayStr,
  formatLocalDateTime,
  localYearMonthStr,
} from '../../../app/lib/dateUtil';

describe('app/lib/dateUtil', () => {
  describe('localTodayStr', () => {
    it('返回 YYYY-MM-DD 格式（默认参数）', () => {
      const s = localTodayStr();
      expect(s).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('始终用 Asia/Shanghai 时区（即使 server 在 UTC）', () => {
      // 2026-01-01T15:30:00Z = 北京时间 2026-01-01 23:30
      const utcLate = new Date('2026-01-01T15:30:00Z');
      expect(localTodayStr(utcLate)).toBe('2026-01-01');

      // 2026-01-01T16:30:00Z = 北京时间 2026-01-02 00:30 → 已跨日
      const utcCrossDay = new Date('2026-01-01T16:30:00Z');
      expect(localTodayStr(utcCrossDay)).toBe('2026-01-02');
    });

    it('月初 / 年初的 padStart 处理', () => {
      // 2026-01-01T00:00:00+08:00 = 北京 2026-01-01
      const d = new Date('2025-12-31T16:00:00Z');
      expect(localTodayStr(d)).toBe('2026-01-01');
    });
  });

  describe('prevDayStr', () => {
    it('返回前一天', () => {
      expect(prevDayStr('2026-01-01')).toBe('2025-12-31');
      expect(prevDayStr('2026-03-01')).toBe('2026-02-28');
      expect(prevDayStr('2026-05-27')).toBe('2026-05-26');
    });

    it('闰年 2 月正确处理', () => {
      expect(prevDayStr('2024-03-01')).toBe('2024-02-29');
    });

    it('跨月、跨年正确', () => {
      expect(prevDayStr('2026-12-01')).toBe('2026-11-30');
      expect(prevDayStr('2027-01-01')).toBe('2026-12-31');
    });
  });

  describe('formatLocalDateTime', () => {
    it('YYYY-MM-DD HH:mm:ss（北京时间，与 server 时区无关）', () => {
      // UTC 15:30:45 → 北京 23:30:45
      const d = new Date('2026-01-01T15:30:45Z');
      expect(formatLocalDateTime(d)).toBe('2026-01-01 23:30:45');
    });

    it('跨日时正确转换', () => {
      // UTC 17:00:00 → 北京次日 01:00:00
      const d = new Date('2026-01-01T17:00:00Z');
      expect(formatLocalDateTime(d)).toBe('2026-01-02 01:00:00');
    });
  });

  describe('localYearMonthStr', () => {
    it('返回 YYYY-MM 格式', () => {
      const d = new Date('2026-05-27T03:00:00Z');
      expect(localYearMonthStr(d)).toBe('2026-05');
    });

    it('跨月时取北京时间所在月', () => {
      // UTC 2026-05-31 17:00:00 → 北京 2026-06-01 01:00 → 应是 06
      const d = new Date('2026-05-31T17:00:00Z');
      expect(localYearMonthStr(d)).toBe('2026-06');
    });
  });
});
