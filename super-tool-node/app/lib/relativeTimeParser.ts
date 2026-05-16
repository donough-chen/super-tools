/**
 * 解析 ISO 8601 duration 风格的相对时间字符串
 * 支持：P30D（30天）、P7D（7天）、P24H（24小时）、P60M（60分钟）
 *
 * @returns SQL 表达式 或 null（不合法时）
 */
export function parseRelativeTime(value: string): { sql: string; ms: number } | null {
  const match = value.match(/^P(\d+)([DHM])$/i);
  if (!match) return null;

  const num = parseInt(match[1], 10);
  const unit = match[2].toUpperCase();

  switch (unit) {
    case 'D':
      return { sql: `NOW() - INTERVAL ${num} DAY`, ms: num * 86400000 };
    case 'H':
      return { sql: `NOW() - INTERVAL ${num} HOUR`, ms: num * 3600000 };
    case 'M':
      return { sql: `NOW() - INTERVAL ${num} MINUTE`, ms: num * 60000 };
    default:
      return null;
  }
}

/**
 * 判断值是否为相对时间字符串
 */
export function isRelativeTime(value: any): boolean {
  return typeof value === 'string' && /^P\d+[DHM]$/i.test(value);
}
