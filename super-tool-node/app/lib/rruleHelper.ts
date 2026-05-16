import { RRule } from 'rrule';

/**
 * 解析 RRULE 字符串并计算下 N 次触发时间
 */
export function parseRRule(rruleStr: string): RRule {
  return RRule.fromString(rruleStr);
}

/**
 * 获取下一次触发时间
 */
export function getNextOccurrence(rruleStr: string, after?: Date): Date | null {
  const rule = parseRRule(rruleStr);
  const next = rule.after(after || new Date(), true);
  return next;
}

/**
 * 预览未来 N 次触发时间
 */
export function previewOccurrences(rruleStr: string, count: number = 5, after?: Date): Date[] {
  const rule = parseRRule(rruleStr);
  const start = after || new Date();
  return rule.between(start, new Date(start.getTime() + 365 * 24 * 3600 * 1000), true).slice(0, count);
}

/**
 * 验证 RRULE 字符串是否合法
 */
export function isValidRRule(rruleStr: string): boolean {
  try {
    const rule = RRule.fromString(rruleStr);
    return !!rule.options.freq;
  } catch {
    return false;
  }
}
