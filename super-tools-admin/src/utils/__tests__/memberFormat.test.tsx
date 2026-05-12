/**
 * memberFormat utils 测试
 *
 * 用 .tsx 扩展名走 babel-jest（jest config 已配置），
 * 避开 ts-jest 26 + TypeScript 5.4 的 hoist-jest `getMutableClone` bug。
 */
import {
  formatCurrency, formatDuration, levelColor,
  POINTS_TYPE_LABELS, POINTS_TYPE_COLORS,
} from '@/utils/memberFormat';

describe('memberFormat utils', () => {
  it('formatCurrency: string DECIMAL → ¥xxx.xx', () => {
    expect(formatCurrency('199.5')).toBe('¥199.50');
    expect(formatCurrency(0)).toBe('¥0.00');
    expect(formatCurrency(null)).toBe('-');
    expect(formatCurrency(undefined)).toBe('-');
    expect(formatCurrency('abc')).toBe('-');
  });

  it('formatDuration: 0=永久，30 倍数=月，365 倍数=年', () => {
    expect(formatDuration(0)).toBe('永久');
    expect(formatDuration(7)).toBe('7 天');
    expect(formatDuration(30)).toBe('1 月');
    expect(formatDuration(60)).toBe('2 月');
    expect(formatDuration(365)).toBe('1 年');
    expect(formatDuration(null)).toBe('-');
  });

  it('levelColor 降级到默认 fallback', () => {
    expect(levelColor('#abc')).toBe('#abc');
    expect(levelColor()).toBe('#999');
    expect(levelColor(undefined, '#000')).toBe('#000');
    expect(levelColor('')).toBe('#999');  // 空字符串也降级
  });

  it('POINTS_TYPE labels & colors 完整映射', () => {
    expect(POINTS_TYPE_LABELS[0]).toBe('支出');
    expect(POINTS_TYPE_LABELS[1]).toBe('收入');
    expect(POINTS_TYPE_COLORS[0]).toBe('red');
    expect(POINTS_TYPE_COLORS[1]).toBe('green');
  });
});
