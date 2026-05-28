/**
 * 字段白名单提取（admin 接口防字段注入）
 *
 * 设计依据：
 *   - docs/superpowers/specs/2026-05-27-积分成长体系后端优化设计文档.md §2.10
 *   - docs/superpowers/plans/2026-05-27-积分成长体系后端优化-B业务修复实施计划.md Task B7/B8
 *
 * 用法：
 *   const TASK_FIELDS = ['name', 'icon', 'status'] as const;
 *   const body = pickFields(ctx.request.body, TASK_FIELDS);
 *   await ctx.model.Task.create(body);
 *
 * 语义：
 *   - source 非对象（null/undefined/原始值）→ 返回 {}
 *   - 仅当 source 自身（非原型链）拥有该字段时才纳入结果
 *   - 不存在的白名单字段不会带入 undefined（用 in 操作符判定）
 *   - 字段值原样保留（包括 null / 空串 / 0 / false）
 */
export function pickFields<K extends string>(
  source: any,
  fields: readonly K[],
): Partial<Record<K, any>> {
  if (!source || typeof source !== 'object') return {};
  const result: Partial<Record<K, any>> = {};
  for (const f of fields) {
    if (Object.prototype.hasOwnProperty.call(source, f)) {
      result[f] = source[f];
    }
  }
  return result;
}
