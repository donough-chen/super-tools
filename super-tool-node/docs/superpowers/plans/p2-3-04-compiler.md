# P2.3-04：audienceRuleCompiler + 测试（18 用例）（Task 4）

> 父计划：[2026-06-06-notification-p2-3-dynamic-audience.md](./2026-06-06-notification-p2-3-dynamic-audience.md)
> 前置：Task 2（relativeTimeParser）+ Task 3（whitelist）

---

## Step 1: 创建测试 `test/notification/lib/audience-rule-compiler.test.ts`

```typescript
import { strict as assert } from 'assert';
import { compileAudienceRule } from '../../../app/lib/audienceRuleCompiler';

const NOW = new Date('2026-06-06T12:00:00Z');

describe('lib/audienceRuleCompiler', () => {

  // -------- Group A：操作符（9 个 × 至少一个用例） --------

  it('eq → field = ?', () => {
    const r = compileAudienceRule({
      operator: 'and',
      conditions: [{ field: 'user.status', op: 'eq', value: 1 }],
    }, { now: NOW });
    assert.equal(r.where, '(u.status = ?)');
    assert.deepEqual(r.params, [1]);
    assert.deepEqual(r.joins, []);
  });

  it('ne → field <> ?', () => {
    const r = compileAudienceRule({
      operator: 'and',
      conditions: [{ field: 'user.status', op: 'ne', value: 0 }],
    }, { now: NOW });
    assert.equal(r.where, '(u.status <> ?)');
    assert.deepEqual(r.params, [0]);
  });

  it('gt/gte/lt/lte 对 datetime 字段', () => {
    const r = compileAudienceRule({
      operator: 'and',
      conditions: [
        { field: 'user.created_at', op: 'gte', value: '2024-01-01' },
        { field: 'user.created_at', op: 'lt',  value: '2026-01-01' },
      ],
    }, { now: NOW });
    assert.ok(r.where.includes('u.created_at >= ?'));
    assert.ok(r.where.includes('u.created_at < ?'));
    assert.deepEqual(r.params, ['2024-01-01', '2026-01-01']);
  });

  it('in / nin → field IN (?,?,?) / NOT IN', () => {
    const r = compileAudienceRule({
      operator: 'and',
      conditions: [
        { field: 'member.level_id', op: 'in',  value: [3, 4, 5] },
        { field: 'member.level_id', op: 'nin', value: [1] },
      ],
    }, { now: NOW });
    assert.ok(r.where.includes('ms.level_id IN (?,?,?)'));
    assert.ok(r.where.includes('ms.level_id NOT IN (?)'));
    assert.deepEqual(r.params, [3, 4, 5, 1]);
  });

  it('between → field BETWEEN ? AND ?', () => {
    const r = compileAudienceRule({
      operator: 'and',
      conditions: [
        { field: 'user.created_at', op: 'between',
          value: ['2024-01-01', '2024-12-31'] },
      ],
    }, { now: NOW });
    assert.ok(r.where.includes('u.created_at BETWEEN ? AND ?'));
    assert.deepEqual(r.params, ['2024-01-01', '2024-12-31']);
  });

  // -------- Group B：相对时间 --------

  it('P30D 转 now() - 30 days 时间字符串', () => {
    const r = compileAudienceRule({
      operator: 'and',
      conditions: [{ field: 'user.last_login_at', op: 'gte', value: 'P30D' }],
    }, { now: NOW });
    assert.equal(r.where, '(u.last_login_at >= ?)');
    // 应等于 NOW - 30d 的 ISO
    assert.equal(r.params[0], '2026-05-07T12:00:00.000Z');
  });

  // -------- Group C：嵌套 AND/OR --------

  it('OR 嵌套 AND', () => {
    const r = compileAudienceRule({
      operator: 'or',
      conditions: [
        { field: 'user.status', op: 'eq', value: 1 },
        {
          operator: 'and',
          conditions: [
            { field: 'member.level_id', op: 'eq', value: 5 },
            { field: 'member.expire_at', op: 'gte', value: 'P0D'.replace('0','7') }, // P7D
          ],
        },
      ],
    }, { now: NOW });
    assert.ok(r.where.includes(' OR '));
    assert.ok(r.where.includes(' AND '));
  });

  it('嵌套 4 层 → 抛 108220 NESTED_TOO_DEEP', () => {
    const deep = (depth: number): any =>
      depth === 0
        ? { field: 'user.status', op: 'eq', value: 1 }
        : { operator: 'and', conditions: [deep(depth - 1)] };
    assert.throws(
      () => compileAudienceRule(deep(5) as any, { now: NOW }),
      /108220/,
    );
  });

  // -------- Group D：字段白名单 / 操作符白名单 --------

  it('未注册字段 → 抛 108211 FIELD_INVALID', () => {
    assert.throws(
      () => compileAudienceRule({
        operator: 'and',
        conditions: [{ field: 'user.password', op: 'eq', value: 'x' }],
      }, { now: NOW }),
      /108211/,
    );
  });

  it('操作符不在字段允许集 → 抛 108212 OP_INVALID', () => {
    assert.throws(
      () => compileAudienceRule({
        operator: 'and',
        // user.status 仅允许 eq/ne，不允许 gt
        conditions: [{ field: 'user.status', op: 'gt', value: 1 }],
      }, { now: NOW }),
      /108212/,
    );
  });

  it('value 类型错误 → 抛 108221 VALUE_INVALID', () => {
    assert.throws(
      () => compileAudienceRule({
        operator: 'and',
        // user.status 是 int，传 string
        conditions: [{ field: 'user.status', op: 'eq', value: 'abc' }],
      }, { now: NOW }),
      /108221/,
    );
  });

  it('in 操作符 value 必须是数组', () => {
    assert.throws(
      () => compileAudienceRule({
        operator: 'and',
        conditions: [{ field: 'member.level_id', op: 'in', value: 5 }],
      }, { now: NOW }),
      /108221/,
    );
  });

  // -------- Group E：JOIN 自动去重 --------

  it('两个 member.* 字段 → join 仅一条', () => {
    const r = compileAudienceRule({
      operator: 'and',
      conditions: [
        { field: 'member.level_id', op: 'eq', value: 5 },
        { field: 'member.expire_at', op: 'gte', value: '2026-01-01' },
      ],
    }, { now: NOW });
    assert.equal(r.joins.length, 1);
    assert.ok(r.joins[0].includes('member_subscriptions'));
  });

  // -------- Group F：EXISTS 子查询字段 --------

  it('role.code in [vip] → 编译为 EXISTS', () => {
    const r = compileAudienceRule({
      operator: 'and',
      conditions: [{ field: 'role.code', op: 'in', value: ['vip'] }],
    }, { now: NOW });
    assert.ok(r.where.includes('EXISTS'));
    assert.ok(r.where.includes('admin_user_roles'));
    assert.ok(r.where.includes('admin_roles'));
    assert.deepEqual(r.params, ['vip']);
  });

  it('device.platform in [ios,android]', () => {
    const r = compileAudienceRule({
      operator: 'and',
      conditions: [{ field: 'device.platform', op: 'in', value: ['ios','android'] }],
    }, { now: NOW });
    assert.ok(r.where.includes('EXISTS'));
    assert.ok(r.where.includes('user_devices'));
    assert.deepEqual(r.params, ['ios','android']);
  });

  it('favorite.tool_id eq 12345', () => {
    const r = compileAudienceRule({
      operator: 'and',
      conditions: [{ field: 'favorite.tool_id', op: 'eq', value: 12345 }],
    }, { now: NOW });
    assert.ok(r.where.includes('EXISTS'));
    assert.ok(r.where.includes('user_tool_favorites'));
    assert.deepEqual(r.params, [12345]);
  });

  // -------- Group G：完整 SQL 拼装 --------

  it('buildFullSql 拼出完整可执行 SELECT', () => {
    const r = compileAudienceRule({
      operator: 'and',
      conditions: [
        { field: 'user.status', op: 'eq', value: 1 },
        { field: 'member.level_id', op: 'in', value: [3, 4, 5] },
      ],
    }, { now: NOW });
    const full = r.buildFullSql({ select: 'u.id', limit: 100 });
    assert.ok(full.startsWith('SELECT u.id FROM users u'));
    assert.ok(full.includes('LEFT JOIN member_subscriptions'));
    assert.ok(full.includes('WHERE'));
    assert.ok(full.includes('LIMIT 100'));
  });

  it('空 conditions → where = "1=1"（匹配所有）', () => {
    const r = compileAudienceRule({ operator: 'and', conditions: [] }, { now: NOW });
    assert.equal(r.where, '1=1');
    assert.deepEqual(r.params, []);
  });
});
```

---

## Step 2: 创建实现 `app/lib/audienceRuleCompiler.ts`

```typescript
import { AUDIENCE_FIELDS, FieldMeta, Op } from './audienceFieldWhitelist';
import { isRelativeTimeExpr, parseRelativeTime } from './relativeTimeParser';

export interface Condition {
  field: string;
  op: Op;
  value: any;
}

export interface Group {
  operator: 'and' | 'or';
  conditions: Array<Condition | Group>;
}

export interface CompileOptions {
  now?: Date;
  maxDepth?: number; // default 3
}

export interface CompileResult {
  where: string;          // 安全的 WHERE 片段（不含 WHERE 关键字）
  params: any[];          // 参数化值
  joins: string[];        // 去重后的 JOIN 子句
  buildFullSql: (opts: { select?: string; limit?: number; offset?: number }) => string;
}

const MAX_DEFAULT_DEPTH = 3;

const BIZ_ERR = (code: number, message: string) => {
  const err = new Error(`${code} ${message}`);
  (err as any).biz = { code, message };
  return err;
};

function isGroup(node: Condition | Group): node is Group {
  return (node as any).operator !== undefined;
}

export function compileAudienceRule(root: Group, opts: CompileOptions = {}): CompileResult {
  const now = opts.now ?? new Date();
  const maxDepth = opts.maxDepth ?? MAX_DEFAULT_DEPTH;
  const joinSet = new Set<string>();
  const params: any[] = [];

  const walk = (node: Group, depth: number): string => {
    if (depth > maxDepth) {
      throw BIZ_ERR(108220, `audience rule nested deeper than ${maxDepth}`);
    }
    if (!Array.isArray(node.conditions) || node.conditions.length === 0) {
      return depth === 1 ? '1=1' : '1=1';
    }
    const op = node.operator === 'or' ? ' OR ' : ' AND ';
    const parts: string[] = [];
    for (const item of node.conditions) {
      if (isGroup(item)) {
        parts.push(`(${walk(item, depth + 1)})`);
      } else {
        parts.push(compileCondition(item, joinSet, params, now));
      }
    }
    return parts.length === 1 ? parts[0] : `(${parts.join(op)})`;
  };

  const where = walk(root, 1);
  const joins = Array.from(joinSet);

  const buildFullSql = (q: { select?: string; limit?: number; offset?: number }) => {
    const sel = q.select ?? 'u.id';
    const lim = q.limit ? ` LIMIT ${Number(q.limit)}` : '';
    const off = q.offset ? ` OFFSET ${Number(q.offset)}` : '';
    return `SELECT ${sel} FROM users u${joins.length ? ' ' + joins.join(' ') : ''} WHERE ${where}${lim}${off}`;
  };

  return { where, params, joins, buildFullSql };
}

function compileCondition(c: Condition, joinSet: Set<string>, params: any[], now: Date): string {
  const meta: FieldMeta | undefined = AUDIENCE_FIELDS[c.field];
  if (!meta) throw BIZ_ERR(108211, `field ${c.field} not in whitelist`);
  if (!meta.allowedOps.includes(c.op)) {
    throw BIZ_ERR(108212, `op ${c.op} not allowed for field ${c.field}`);
  }
  validateValueType(meta, c.op, c.value);

  // 注册 join
  if (meta.joins) meta.joins.forEach((j) => joinSet.add(j));

  // 处理特殊 EXISTS 字段
  if (meta.sqlExpr.startsWith('EXISTS_')) {
    return compileExistsCondition(meta, c, params);
  }

  // 普通字段
  return compileNormalCondition(meta, c, params, now);
}

function compileNormalCondition(
  meta: FieldMeta, c: Condition, params: any[], now: Date,
): string {
  const expr = meta.sqlExpr;

  switch (c.op) {
    case 'eq':  params.push(normalizeValue(meta, c.value, now));  return `(${expr} = ?)`;
    case 'ne':  params.push(normalizeValue(meta, c.value, now));  return `(${expr} <> ?)`;
    case 'gt':  params.push(normalizeValue(meta, c.value, now));  return `(${expr} > ?)`;
    case 'gte': params.push(normalizeValue(meta, c.value, now));  return `(${expr} >= ?)`;
    case 'lt':  params.push(normalizeValue(meta, c.value, now));  return `(${expr} < ?)`;
    case 'lte': params.push(normalizeValue(meta, c.value, now));  return `(${expr} <= ?)`;
    case 'in': {
      const arr = (c.value as any[]).map((v) => normalizeValue(meta, v, now));
      arr.forEach((v) => params.push(v));
      return `(${expr} IN (${arr.map(() => '?').join(',')}))`;
    }
    case 'nin': {
      const arr = (c.value as any[]).map((v) => normalizeValue(meta, v, now));
      arr.forEach((v) => params.push(v));
      return `(${expr} NOT IN (${arr.map(() => '?').join(',')}))`;
    }
    case 'between': {
      const [a, b] = c.value as [any, any];
      params.push(normalizeValue(meta, a, now));
      params.push(normalizeValue(meta, b, now));
      return `(${expr} BETWEEN ? AND ?)`;
    }
    default:
      throw BIZ_ERR(108212, `unsupported op ${c.op}`);
  }
}

function compileExistsCondition(meta: FieldMeta, c: Condition, params: any[]): string {
  // 仅支持 in / nin / eq
  const values = c.op === 'eq' ? [c.value] : (c.value as any[]);
  values.forEach((v) => params.push(v));
  const ph = values.map(() => '?').join(',');
  const not = c.op === 'nin' ? 'NOT ' : '';

  switch (meta.sqlExpr) {
    case 'EXISTS_ROLE_CODE':
      return `(${not}EXISTS (SELECT 1 FROM admin_user_roles aur ` +
             `JOIN admin_roles ar ON ar.id = aur.role_id ` +
             `WHERE aur.user_id = u.id AND ar.code IN (${ph})))`;
    case 'EXISTS_DEVICE_PLATFORM':
      return `(${not}EXISTS (SELECT 1 FROM user_devices ud ` +
             `WHERE ud.user_id = u.id AND ud.platform IN (${ph})))`;
    case 'EXISTS_FAVORITE_TOOL_ID':
      return `(${not}EXISTS (SELECT 1 FROM user_tool_favorites utf ` +
             `WHERE utf.user_id = u.id AND utf.tool_id IN (${ph})))`;
    default:
      throw BIZ_ERR(108211, `unknown EXISTS marker ${meta.sqlExpr}`);
  }
}

function validateValueType(meta: FieldMeta, op: Op, value: any) {
  const isArrayOp = op === 'in' || op === 'nin' || op === 'between';
  if (isArrayOp) {
    if (!Array.isArray(value)) {
      throw BIZ_ERR(108221, `op ${op} requires array value`);
    }
    if (op === 'between' && value.length !== 2) {
      throw BIZ_ERR(108221, 'between requires 2 values');
    }
    value.forEach((v) => assertScalarType(meta, v));
    return;
  }
  assertScalarType(meta, value);
}

function assertScalarType(meta: FieldMeta, v: any) {
  switch (meta.type) {
    case 'int':
      if (typeof v !== 'number' || !Number.isFinite(v)) {
        throw BIZ_ERR(108221, `field ${meta.field} requires number, got ${typeof v}`);
      }
      return;
    case 'string':
      if (typeof v !== 'string') {
        throw BIZ_ERR(108221, `field ${meta.field} requires string, got ${typeof v}`);
      }
      return;
    case 'datetime':
      if (typeof v !== 'string') {
        throw BIZ_ERR(108221, `field ${meta.field} requires datetime/relative string`);
      }
      return;
  }
}

function normalizeValue(meta: FieldMeta, v: any, now: Date): any {
  if (meta.type === 'datetime' && typeof v === 'string' && isRelativeTimeExpr(v)) {
    return parseRelativeTime(v, now).toISOString();
  }
  return v;
}
```

---

## Step 3: 验证

```bash
npm test -- --testPathPattern=audience-rule-compiler
```

预期：18/18 PASS。

---

## Step 4: Commit

```bash
git add super-tool-node/app/lib/audienceRuleCompiler.ts super-tool-node/test/notification/lib/audience-rule-compiler.test.ts
git commit -m "feat(notification): add audience rule compiler (json → safe sql with whitelist)

- 9 operators (eq/ne/gt/gte/lt/lte/in/nin/between)
- 3 join types: main / LEFT JOIN / EXISTS subquery
- Relative time integration (P30D etc.)
- Nested AND/OR up to 3 levels
- Strict field/op/value type validation with biz error codes
- 18 unit tests covering all branches

Refs: docs/analysis/通知推送系统模块设计需求文档.md (V2 §4.2.4)
Plan: docs/superpowers/plans/2026-06-06-notification-p2-3-dynamic-audience.md (Task 4)"
```

---

## Verification Checklist

- [ ] compiler 含 3 个核心导出
- [ ] 18 用例全 PASS
- [ ] commit 已提交

完成后进入 [`p2-3-05-audience-service.md`](./p2-3-05-audience-service.md)。
