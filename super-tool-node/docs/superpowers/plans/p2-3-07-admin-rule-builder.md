# P2.3-07：Admin UI - RuleBuilder 组件套件（Task 7）

> 父计划：[2026-06-06-notification-p2-3-dynamic-audience.md](./2026-06-06-notification-p2-3-dynamic-audience.md)
> 前置：Task 6（admin API 已就绪）

---

## Step 1: 扩展 `src/services/notification.ts`

```typescript
import { request } from 'umi';

export const NotificationAudienceApi = {
  list:        (params: any) => request('/api/admin/notification/audiences', { params }),
  detail:      (id: number)  => request(`/api/admin/notification/audiences/${id}`),
  create:      (data: any)   => request('/api/admin/notification/audiences', { method: 'POST', data }),
  update:      (id: number, data: any) =>
                              request(`/api/admin/notification/audiences/${id}`, { method: 'PUT', data }),
  destroy:     (id: number)  => request(`/api/admin/notification/audiences/${id}`, { method: 'DELETE' }),
  preview:     (data: { audienceRule: any; audienceId?: number }) =>
                              request('/api/admin/notification/audiences/preview', { method: 'POST', data }),
  metaFields:  ()            => request('/api/admin/notification/audiences/meta/fields'),
};
```

---

## Step 2: `src/pages/Notification/_shared/RuleBuilder/relativeTimeHelper.ts`

```typescript
/** UI 端：把 'P30D' / 'PT15M' 解析为 { mode: 'days', value: 30 } 用于表单 */

const PATTERNS = [
  { mode: 'days', re: /^P(\d+)D$/ },
  { mode: 'hours', re: /^P(\d+)H$/ },
  { mode: 'months', re: /^P(\d+)M$/ },
  { mode: 'minutes', re: /^PT(\d+)M$/ },
] as const;

export type RelTimeMode = 'days' | 'hours' | 'months' | 'minutes';

export function parseRelTime(s: string): { mode: RelTimeMode; value: number } | null {
  for (const p of PATTERNS) {
    const m = p.re.exec(s);
    if (m) return { mode: p.mode, value: Number(m[1]) };
  }
  return null;
}

export function buildRelTime(mode: RelTimeMode, value: number): string {
  switch (mode) {
    case 'days':    return `P${value}D`;
    case 'hours':   return `P${value}H`;
    case 'months':  return `P${value}M`;
    case 'minutes': return `PT${value}M`;
  }
}
```

---

## Step 3: `RuleBuilder/FieldSelect.tsx`

```tsx
import React, { useEffect, useState } from 'react';
import { Select } from 'antd';
import { NotificationAudienceApi } from '@/services/notification';

let cache: any[] | null = null;

export interface FieldMeta {
  value: string;
  type: 'int' | 'string' | 'datetime';
  allowedOps: string[];
}

export default function FieldSelect(props: {
  value?: string;
  onChange?: (v: string, meta: FieldMeta) => void;
}) {
  const [fields, setFields] = useState<FieldMeta[]>(cache ?? []);
  useEffect(() => {
    if (!cache) {
      NotificationAudienceApi.metaFields().then((r: any) => {
        cache = r.list;
        setFields(r.list);
      });
    }
  }, []);
  return (
    <Select
      style={{ width: 220 }}
      value={props.value}
      placeholder="选择字段"
      showSearch
      options={fields.map((f) => ({ value: f.value, label: f.value }))}
      onChange={(v) => {
        const meta = fields.find((f) => f.value === v)!;
        props.onChange?.(v, meta);
      }}
    />
  );
}
```

---

## Step 4: `RuleBuilder/OperatorSelect.tsx`

```tsx
import React from 'react';
import { Select } from 'antd';

const OP_LABEL: Record<string, string> = {
  eq:'=', ne:'≠', gt:'>', gte:'≥', lt:'<', lte:'≤',
  in:'∈ 包含', nin:'∉ 不含', between:'介于',
};

export default function OperatorSelect(props: {
  allowedOps: string[];
  value?: string;
  onChange?: (v: string) => void;
}) {
  return (
    <Select
      style={{ width: 110 }}
      value={props.value}
      placeholder="操作符"
      onChange={props.onChange}
      options={props.allowedOps.map((op) => ({ value: op, label: OP_LABEL[op] || op }))}
    />
  );
}
```

---

## Step 5: `RuleBuilder/ValueInput.tsx`

```tsx
import React from 'react';
import { Input, InputNumber, Select, DatePicker, Space, Switch, Tooltip } from 'antd';
import dayjs from 'dayjs';
import { parseRelTime, buildRelTime, RelTimeMode } from './relativeTimeHelper';

const REL_MODE_OPTS = [
  { value: 'days', label: '天前' },
  { value: 'hours', label: '小时前' },
  { value: 'months', label: '月前(30 天)' },
  { value: 'minutes', label: '分钟前' },
];

export default function ValueInput(props: {
  fieldType: 'int' | 'string' | 'datetime';
  op: string;
  value: any;
  onChange: (v: any) => void;
}) {
  const { fieldType, op } = props;
  const isMulti = op === 'in' || op === 'nin';
  const isBetween = op === 'between';

  // datetime 字段允许"绝对时间"或"相对时间"
  if (fieldType === 'datetime') {
    const rel = typeof props.value === 'string' ? parseRelTime(props.value) : null;
    const isRel = !!rel;
    if (isBetween) {
      const arr = Array.isArray(props.value) ? props.value : [null, null];
      return (
        <DatePicker.RangePicker
          showTime
          value={[arr[0] ? dayjs(arr[0]) : null, arr[1] ? dayjs(arr[1]) : null] as any}
          onChange={(rng) => props.onChange([
            rng?.[0]?.toISOString() || null, rng?.[1]?.toISOString() || null,
          ])}
        />
      );
    }
    return (
      <Space>
        <Switch checked={isRel} checkedChildren="相对" unCheckedChildren="绝对"
          onChange={(v) => props.onChange(v ? buildRelTime('days', 30) : null)} />
        {isRel ? (
          <>
            <InputNumber min={1} value={rel!.value}
              onChange={(n) => props.onChange(buildRelTime(rel!.mode, n || 1))} />
            <Select value={rel!.mode} options={REL_MODE_OPTS} style={{ width: 120 }}
              onChange={(m) => props.onChange(buildRelTime(m as RelTimeMode, rel!.value))} />
            <Tooltip title="相对当前时间倒推">
              <span style={{ color: '#999' }}>{props.value}</span>
            </Tooltip>
          </>
        ) : (
          <DatePicker showTime value={props.value ? dayjs(props.value) : null}
            onChange={(d) => props.onChange(d?.toISOString() || null)} />
        )}
      </Space>
    );
  }

  // int 字段
  if (fieldType === 'int') {
    if (isBetween) {
      const arr = Array.isArray(props.value) ? props.value : [null, null];
      return (
        <Space>
          <InputNumber value={arr[0]} onChange={(v) => props.onChange([v, arr[1]])} />
          <InputNumber value={arr[1]} onChange={(v) => props.onChange([arr[0], v])} />
        </Space>
      );
    }
    if (isMulti) {
      return (
        <Select mode="tags" placeholder="多个数字回车分隔" style={{ minWidth: 220 }}
          value={Array.isArray(props.value) ? props.value.map(String) : []}
          onChange={(arr) => props.onChange(arr.map(Number).filter((n) => Number.isFinite(n)))} />
      );
    }
    return <InputNumber value={props.value} onChange={(v) => props.onChange(v)} />;
  }

  // string 字段
  if (isMulti) {
    return (
      <Select mode="tags" placeholder="多个值回车分隔" style={{ minWidth: 220 }}
        value={Array.isArray(props.value) ? props.value : []}
        onChange={(arr) => props.onChange(arr)} />
    );
  }
  return <Input value={props.value} onChange={(e) => props.onChange(e.target.value)} style={{ width: 220 }} />;
}
```

---

## Step 6: `RuleBuilder/ConditionRow.tsx`

```tsx
import React, { useState } from 'react';
import { Space, Button } from 'antd';
import { DeleteOutlined } from '@ant-design/icons';
import FieldSelect, { FieldMeta } from './FieldSelect';
import OperatorSelect from './OperatorSelect';
import ValueInput from './ValueInput';

export default function ConditionRow(props: {
  value: { field: string; op: string; value: any };
  onChange: (v: any) => void;
  onRemove: () => void;
}) {
  const [meta, setMeta] = useState<FieldMeta | null>(null);

  return (
    <Space style={{ marginBottom: 8 }} align="start">
      <FieldSelect value={props.value.field} onChange={(f, m) => {
        setMeta(m);
        props.onChange({ field: f, op: m.allowedOps[0] || 'eq', value: null });
      }} />
      <OperatorSelect
        allowedOps={meta?.allowedOps || ['eq','ne','gt','gte','lt','lte','in','nin','between']}
        value={props.value.op}
        onChange={(op) => props.onChange({ ...props.value, op, value: null })}
      />
      <ValueInput
        fieldType={meta?.type || 'string'}
        op={props.value.op}
        value={props.value.value}
        onChange={(v) => props.onChange({ ...props.value, value: v })}
      />
      <Button type="text" danger icon={<DeleteOutlined />} onClick={props.onRemove} />
    </Space>
  );
}
```

---

## Step 7: `RuleBuilder/GroupBlock.tsx` + `index.tsx`

```tsx
// GroupBlock.tsx
import React from 'react';
import { Card, Radio, Button, Space } from 'antd';
import { PlusOutlined, BranchesOutlined } from '@ant-design/icons';
import ConditionRow from './ConditionRow';

export interface GroupValue {
  operator: 'and' | 'or';
  conditions: any[];
}

export default function GroupBlock(props: {
  value: GroupValue;
  onChange: (v: GroupValue) => void;
  onRemove?: () => void;
  depth: number;
  maxDepth?: number;
}) {
  const max = props.maxDepth ?? 3;
  const update = (i: number, v: any) => {
    const next = [...props.value.conditions];
    next[i] = v;
    props.onChange({ ...props.value, conditions: next });
  };
  const remove = (i: number) => {
    const next = props.value.conditions.filter((_, idx) => idx !== i);
    props.onChange({ ...props.value, conditions: next });
  };

  return (
    <Card size="small"
      title={<Radio.Group value={props.value.operator}
              onChange={(e) => props.onChange({ ...props.value, operator: e.target.value })}>
        <Radio.Button value="and">AND（同时满足）</Radio.Button>
        <Radio.Button value="or">OR（任一满足）</Radio.Button>
      </Radio.Group>}
      extra={props.onRemove && <Button danger size="small" type="text" onClick={props.onRemove}>移除分组</Button>}
      style={{ marginBottom: 8 }}>
      {props.value.conditions.map((c, i) => {
        if (c.operator) {
          return <GroupBlock key={i} value={c} onChange={(v) => update(i, v)}
                  onRemove={() => remove(i)} depth={props.depth + 1} maxDepth={max} />;
        }
        return <ConditionRow key={i} value={c}
                  onChange={(v) => update(i, v)} onRemove={() => remove(i)} />;
      })}
      <Space>
        <Button size="small" icon={<PlusOutlined />} onClick={() =>
          props.onChange({ ...props.value, conditions: [
            ...props.value.conditions,
            { field: 'user.status', op: 'eq', value: null },
          ]})}>添加条件</Button>
        {props.depth < max && (
          <Button size="small" icon={<BranchesOutlined />} onClick={() =>
            props.onChange({ ...props.value, conditions: [
              ...props.value.conditions,
              { operator: 'and', conditions: [] },
            ]})}>添加子分组</Button>
        )}
      </Space>
    </Card>
  );
}
```

```tsx
// index.tsx
import React from 'react';
import GroupBlock, { GroupValue } from './GroupBlock';

export default function RuleBuilder(props: {
  value?: GroupValue;
  onChange?: (v: GroupValue) => void;
  maxDepth?: number;
}) {
  const v = props.value || { operator: 'and', conditions: [] };
  return (
    <GroupBlock
      value={v}
      onChange={(nv) => props.onChange?.(nv)}
      depth={1}
      maxDepth={props.maxDepth ?? 3}
    />
  );
}
```

---

## Step 8: 验证 & Commit

> 本步骤无单测；目视验证：在任意页面临时挂载 `<RuleBuilder onChange={console.log} />`，观察控制台 onChange 输出 JSON 与后端 compiler 期望格式一致。

```bash
git add super-tools-admin/src/services/notification.ts super-tools-admin/src/pages/Notification/_shared/RuleBuilder/
git commit -m "feat(admin): notification audience RuleBuilder component suite

- FieldSelect: cached fields from /meta/fields
- OperatorSelect: filtered by field's allowedOps
- ValueInput: int/string/datetime + multi/between/relative-time
- ConditionRow: field+op+value compose
- GroupBlock: AND/OR + nested up to 3 levels (UI enforced)
- RuleBuilder: root wrapper

Refs: docs/analysis/通知推送系统模块设计需求文档.md (V2 §4.2.4 §8)
Plan: docs/superpowers/plans/2026-06-06-notification-p2-3-dynamic-audience.md (Task 7)"
```

---

## Verification Checklist

- [ ] 6 个组件文件存在
- [ ] 字段下拉来自 API；切换字段后 op 列表自动收缩
- [ ] datetime 字段绝对/相对切换可用
- [ ] 嵌套 ≤ 3 层（UI 端 + compiler 双重保险）
- [ ] commit 已提交

完成后进入 [`p2-3-08-admin-pages.md`](./p2-3-08-admin-pages.md)。
