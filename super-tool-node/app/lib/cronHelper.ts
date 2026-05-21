/**
 * @file Cron 表达式工具
 * @description 提供 Cron 表达式的验证、下次触发时间计算和预览功能。
 *   基于 cron-parser 库，默认时区 Asia/Shanghai。
 *   用于任务调度服务中的 cron 类型任务。
 *
 * @module lib/cronHelper
 */
import * as cronParser from 'cron-parser';

/**
 * 验证 cron 表达式是否合法
 */
export function isValidCron(expr: string): boolean {
  try {
    cronParser.parseExpression(expr);
    return true;
  } catch {
    return false;
  }
}

/**
 * 获取下一次触发时间
 */
export function getNextCronTime(expr: string, tz?: string): Date | null {
  try {
    const interval = cronParser.parseExpression(expr, { tz: tz || 'Asia/Shanghai' });
    return interval.next().toDate();
  } catch {
    return null;
  }
}

/**
 * 预览未来 N 次触发时间
 */
export function previewCronTimes(expr: string, count: number = 5, tz?: string): Date[] {
  try {
    const interval = cronParser.parseExpression(expr, { tz: tz || 'Asia/Shanghai' });
    const results: Date[] = [];
    for (let i = 0; i < count; i++) {
      results.push(interval.next().toDate());
    }
    return results;
  } catch {
    return [];
  }
}
