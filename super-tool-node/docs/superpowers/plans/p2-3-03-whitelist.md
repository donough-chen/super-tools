# P2.3-03：audienceFieldWhitelist 元数据表（Task 3）

> 父计划：[2026-06-06-notification-p2-3-dynamic-audience.md](./2026-06-06-notification-p2-3-dynamic-audience.md)

---

## Step 1: 创建 `app/lib/audienceFieldWhitelist.ts`

```typescript
/**
 * 受众规则字段白名单。
 *
 * 安全契约：
 * - field path 必须是这里定义过的；compiler 不接受任何未注册字段。
 * - sqlExpr 是受信任的（编译期常量），可直接拼到 SQL；value 必须走参数化。
 * - join 子句多次出现自动去重。
 *
 * 类型说明（type）：
 * - int      → value 必须 number；in/nin 接受 number[]
 * - string   → value 必须 string；in/nin 接受 string[]
 * - datetime → value 必须 ISO 字符串 / 'P{N}D' 等相对时间
 */

export type FieldType = 'int' | 'string' | 'datetime';
export type Op = 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'nin' | 'between';

export interface FieldMeta {
  field: string;            // 用户输入的 path：user.status
  type: FieldType;
  allowedOps: Op[];
  /** SQL 片段，用作 WHERE 比较的左侧；不接收任何用户输入 */
  sqlExpr: string;
  /** 该字段需要的 join 子句；多个字段共用同一 join 时自动去重（按字符串） */
  joins?: string[];
}

const ALL_NUMERIC_OPS: Op[] = ['eq','ne','gt','gte','lt','lte','in','nin','between'];
const STRING_OPS: Op[] = ['eq','ne','in','nin'];
const DATETIME_OPS: Op[] = ['gt','gte','lt','lte','between'];
const SET_ONLY_OPS: Op[] = ['in','nin'];

/**
 * 主表别名约定：u = users
 * 子表别名约定：ms = member_subscriptions, ud = user_devices, utf = user_tool_favorites,
 *              aur = admin_user_roles, ar = admin_roles
 */
export const AUDIENCE_FIELDS: Record<string, FieldMeta> = {
  'user.id': {
    field: 'user.id', type: 'int',
    allowedOps: ['eq','ne','in','nin'],
    sqlExpr: 'u.id',
  },
  'user.status': {
    field: 'user.status', type: 'int',
    allowedOps: ['eq','ne'],
    sqlExpr: 'u.status',
  },
  'user.created_at': {
    field: 'user.created_at', type: 'datetime',
    allowedOps: DATETIME_OPS,
    sqlExpr: 'u.created_at',
  },
  'user.last_login_at': {
    field: 'user.last_login_at', type: 'datetime',
    allowedOps: DATETIME_OPS,
    sqlExpr: 'u.last_login_at',
  },
  'member.level_id': {
    field: 'member.level_id', type: 'int',
    allowedOps: ['eq','ne','in','nin'],
    sqlExpr: 'ms.level_id',
    joins: ['LEFT JOIN member_subscriptions ms ON ms.user_id = u.id AND ms.status = 1'],
  },
  'member.expire_at': {
    field: 'member.expire_at', type: 'datetime',
    allowedOps: DATETIME_OPS,
    sqlExpr: 'ms.expire_at',
    joins: ['LEFT JOIN member_subscriptions ms ON ms.user_id = u.id AND ms.status = 1'],
  },
  'role.code': {
    field: 'role.code', type: 'string',
    allowedOps: SET_ONLY_OPS,
    // role 一对多用 EXISTS；compiler 检测到 EXISTS 形态会做特殊封装
    sqlExpr: 'EXISTS_ROLE_CODE',
  },
  'device.platform': {
    field: 'device.platform', type: 'string',
    allowedOps: SET_ONLY_OPS,
    sqlExpr: 'EXISTS_DEVICE_PLATFORM',
  },
  'favorite.tool_id': {
    field: 'favorite.tool_id', type: 'int',
    allowedOps: ['eq','in'],
    sqlExpr: 'EXISTS_FAVORITE_TOOL_ID',
  },
};

/** 给 admin UI 用：返回字段 + 类型 + 操作符列表（用于 Select 下拉） */
export function listFieldsForUI(): Array<{
  value: string; type: FieldType; allowedOps: Op[];
}> {
  return Object.values(AUDIENCE_FIELDS).map((m) => ({
    value: m.field, type: m.type, allowedOps: m.allowedOps,
  }));
}

export function getFieldMeta(path: string): FieldMeta | null {
  return AUDIENCE_FIELDS[path] || null;
}
```

> 设计说明：`role.code / device.platform / favorite.tool_id` 因为是一对多关系，不能直接 `JOIN` 后用 `=`（会导致 user 重复），所以用 `EXISTS` 子查询。compiler 通过特殊 `sqlExpr` 标记识别这类字段并生成 `EXISTS (SELECT 1 FROM ... WHERE user_id = u.id AND col IN (...))`。

---

## Step 2: 测试 `test/notification/lib/audience-field-whitelist.test.ts`（4 用例）

```typescript
import { strict as assert } from 'assert';
import { AUDIENCE_FIELDS, listFieldsForUI, getFieldMeta } from '../../../app/lib/audienceFieldWhitelist';

describe('lib/audienceFieldWhitelist', () => {
  it('包含 9 个字段', () => {
    assert.equal(Object.keys(AUDIENCE_FIELDS).length, 9);
  });

  it('getFieldMeta 命中', () => {
    const m = getFieldMeta('user.status');
    assert.ok(m);
    assert.equal(m!.type, 'int');
  });

  it('getFieldMeta 未注册返回 null', () => {
    assert.equal(getFieldMeta('user.password'), null);
  });

  it('listFieldsForUI 返回所有字段', () => {
    const list = listFieldsForUI();
    assert.equal(list.length, 9);
    list.forEach((f) => {
      assert.ok(['int','string','datetime'].includes(f.type));
      assert.ok(Array.isArray(f.allowedOps));
    });
  });
});
```

---

## Step 3: 验证 & Commit

```bash
npm test -- --testPathPattern=audience-field-whitelist
```

预期：4/4 PASS。

```bash
git add super-tool-node/app/lib/audienceFieldWhitelist.ts super-tool-node/test/notification/lib/audience-field-whitelist.test.ts
git commit -m "feat(notification): add audience field whitelist (9 fields, 3 join types)

- AUDIENCE_FIELDS: 9 entries covering user/member/role/device/favorite
- one-to-many fields use EXISTS subquery markers (role/device/favorite)
- listFieldsForUI: helper for admin UI dropdowns
- 4 unit tests

Refs: docs/analysis/通知推送系统模块设计需求文档.md (V2 §4.2.4)
Plan: docs/superpowers/plans/2026-06-06-notification-p2-3-dynamic-audience.md (Task 3)"
```

---

## Verification Checklist

- [ ] `audienceFieldWhitelist.ts` 含 9 字段 + 4 用例
- [ ] commit 已提交

完成后进入 [`p2-3-04-compiler.md`](./p2-3-04-compiler.md)。
