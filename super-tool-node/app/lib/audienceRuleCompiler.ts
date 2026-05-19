import { AUDIENCE_FIELDS, type FieldMeta, type Op } from './audienceFieldWhitelist';
import { isRelativeTime, parseRelativeTime } from './relativeTimeParser';

/**
 * 规则结构定义
 */
export interface Condition {
  field: string;
  op: Op;
  value: any;
}

export interface Group {
  operator: 'and' | 'or';
  conditions: Array<Condition | Group>;
}

export interface CompileResult {
  where: string;
  params: any[];
  joins: Set<string>;
}

/**
 * 编译规则 JSON → SQL 片段
 *
 * 安全保证：
 * 1. 字段必须在白名单内（不允许任意列名注入）
 * 2. 值全部参数化（Sequelize replacements）
 * 3. 嵌套最大 3 层
 */
export function compileAudienceRule(rule: Group, maxDepth: number = 3): CompileResult {
  const params: any[] = [];
  const joins = new Set<string>();

  const where = _compileGroup(rule, params, joins, 0, maxDepth);
  return { where, params, joins };
}

function _compileGroup(group: Group, params: any[], joins: Set<string>, depth: number, maxDepth: number): string {
  if (depth > maxDepth) {
    throw new Error(`规则嵌套超过 ${maxDepth} 层`);
  }

  const op = group.operator === 'or' ? ' OR ' : ' AND ';
  const parts: string[] = [];

  for (const cond of group.conditions) {
    if ('operator' in cond && 'conditions' in cond) {
      // 嵌套 Group
      const sub = _compileGroup(cond as Group, params, joins, depth + 1, maxDepth);
      parts.push(`(${sub})`);
    } else {
      // Condition
      const sql = _compileCondition(cond as Condition, params, joins);
      parts.push(sql);
    }
  }

  return parts.length > 0 ? parts.join(op) : '1=1';
}

function _compileCondition(cond: Condition, params: any[], joins: Set<string>): string {
  const meta = AUDIENCE_FIELDS[cond.field];
  if (!meta) {
    throw new Error(`字段 ${cond.field} 不在白名单`);
  }
  if (!meta.ops.includes(cond.op)) {
    throw new Error(`字段 ${cond.field} 不支持操作符 ${cond.op}`);
  }

  // 收集 join（支持单条字符串或数组，Set 自动去重）
  if (meta.joinClause) {
    const clauses = Array.isArray(meta.joinClause) ? meta.joinClause : [meta.joinClause];
    clauses.forEach(c => joins.add(c));
  }

  const col = `${meta.table}.${meta.column}`;

  // 处理相对时间
  const resolveValue = (v: any): string => {
    if (isRelativeTime(v)) {
      const rt = parseRelativeTime(v);
      if (rt) return rt.sql; // 直接内联 SQL 表达式
    }
    params.push(v);
    return '?';
  };

  switch (cond.op) {
    case 'eq':
      return `${col} = ${resolveValue(cond.value)}`;
    case 'ne':
      return `${col} != ${resolveValue(cond.value)}`;
    case 'gt':
      return `${col} > ${resolveValue(cond.value)}`;
    case 'gte':
      return `${col} >= ${resolveValue(cond.value)}`;
    case 'lt':
      return `${col} < ${resolveValue(cond.value)}`;
    case 'lte':
      return `${col} <= ${resolveValue(cond.value)}`;
    case 'in': {
      const arr = Array.isArray(cond.value) ? cond.value : [cond.value];
      const placeholders = arr.map((v: any) => resolveValue(v)).join(',');
      return `${col} IN (${placeholders})`;
    }
    case 'nin': {
      const arr = Array.isArray(cond.value) ? cond.value : [cond.value];
      const placeholders = arr.map((v: any) => resolveValue(v)).join(',');
      return `${col} NOT IN (${placeholders})`;
    }
    case 'between': {
      const [low, high] = Array.isArray(cond.value) ? cond.value : [cond.value, cond.value];
      return `${col} BETWEEN ${resolveValue(low)} AND ${resolveValue(high)}`;
    }
    default:
      throw new Error(`不支持的操作符: ${cond.op}`);
  }
}
