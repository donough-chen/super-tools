/**
 * 通用时间格式化工具
 * Spec-C2a 引入；后续业务页面共用
 */

/** YYYY-MM-DD HH:mm */
export function formatDateTime(v?: string | number | Date | null): string {
  if (!v) return '-';
  const d = v instanceof Date ? v : new Date(v);
  if (isNaN(d.getTime())) return String(v);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** YYYY-MM-DD */
export function formatDate(v?: string | number | Date | null): string {
  if (!v) return '-';
  const d = v instanceof Date ? v : new Date(v);
  if (isNaN(d.getTime())) return String(v);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
