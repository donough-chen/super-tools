/**
 * 字段级 diff 工具（Spec-C1）
 *
 * - 浅比较两个对象的所有 key
 * - 返回值不同的字段（含 added / removed / changed）
 * - 嵌套对象/数组用 JSON.stringify 比较（不深入展开）
 * - 自动跳过系统时间字段（updatedAt / createdAt / deletedAt）
 *
 * 用于 AuditLogs 详情页"变化字段"对比表。
 */

export interface DiffEntry {
  key: string;
  before: any;
  after: any;
}

const SYSTEM_FIELDS = new Set(['updatedAt', 'createdAt', 'deletedAt']);

export function diffFields(
  before: Record<string, any> | null | undefined,
  after: Record<string, any> | null | undefined,
): DiffEntry[] {
  // 双 null（如 export 等无副作用操作）
  if (!before && !after) return [];

  // 删除：only before（destroy 操作的常见形态）
  if (before && !after) {
    return Object.keys(before)
      .filter((k) => !SYSTEM_FIELDS.has(k))
      .map((k) => ({ key: k, before: before[k], after: undefined }));
  }

  // 创建：only after
  if (!before && after) {
    return Object.keys(after)
      .filter((k) => !SYSTEM_FIELDS.has(k))
      .map((k) => ({ key: k, before: undefined, after: after[k] }));
  }

  // 更新：合并所有 key 取并集，逐个比较
  const allKeys = new Set([
    ...Object.keys(before!),
    ...Object.keys(after!),
  ]);

  const result: DiffEntry[] = [];
  for (const k of allKeys) {
    if (SYSTEM_FIELDS.has(k)) continue;
    const b = before![k];
    const a = after![k];
    if (!isEqual(b, a)) {
      result.push({ key: k, before: b, after: a });
    }
  }
  return result;
}

/** 浅 + 嵌套 JSON.stringify 比较 */
function isEqual(a: any, b: any): boolean {
  if (a === b) return true;
  if (a == null || b == null) return a === b;
  if (typeof a !== typeof b) return false;
  if (typeof a === 'object') {
    try {
      return JSON.stringify(a) === JSON.stringify(b);
    } catch {
      return false;
    }
  }
  return false;
}
