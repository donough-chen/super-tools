# P2.3-02：relativeTimeParser + 测试（Task 2）

> 父计划：[2026-06-06-notification-p2-3-dynamic-audience.md](./2026-06-06-notification-p2-3-dynamic-audience.md)

---

## Step 1: 创建测试 `test/notification/lib/relative-time-parser.test.ts`

```typescript
import { strict as assert } from 'assert';
import { isRelativeTimeExpr, parseRelativeTime } from '../../../app/lib/relativeTimeParser';

describe('lib/relativeTimeParser', () => {
  it('isRelativeTimeExpr 识别 P30D / P12H / P5M / PT15M', () => {
    assert.equal(isRelativeTimeExpr('P30D'), true);
    assert.equal(isRelativeTimeExpr('P12H'), true);
    assert.equal(isRelativeTimeExpr('P5M'), true);
    assert.equal(isRelativeTimeExpr('PT15M'), true); // 分钟（ISO PT 前缀）
    assert.equal(isRelativeTimeExpr('2024-01-01'), false);
    assert.equal(isRelativeTimeExpr('xyz'), false);
  });

  it('parseRelativeTime P30D → 30 天前', () => {
    const now = new Date('2026-06-06T12:00:00Z');
    const r = parseRelativeTime('P30D', now);
    assert.equal(r.toISOString(), '2026-05-07T12:00:00.000Z');
  });

  it('parseRelativeTime P12H → 12 小时前', () => {
    const now = new Date('2026-06-06T12:00:00Z');
    const r = parseRelativeTime('P12H', now);
    assert.equal(r.toISOString(), '2026-06-06T00:00:00.000Z');
  });

  it('parseRelativeTime P5M → 5 个月前（按 30 天近似）', () => {
    const now = new Date('2026-06-06T12:00:00Z');
    const r = parseRelativeTime('P5M', now);
    // 5*30 = 150 天前
    const expected = new Date(now.getTime() - 150 * 86400_000);
    assert.equal(r.getTime(), expected.getTime());
  });

  it('parseRelativeTime PT15M → 15 分钟前', () => {
    const now = new Date('2026-06-06T12:00:00Z');
    const r = parseRelativeTime('PT15M', now);
    assert.equal(r.toISOString(), '2026-06-06T11:45:00.000Z');
  });

  it('parseRelativeTime 非法格式抛错', () => {
    assert.throws(() => parseRelativeTime('not-a-time'), /invalid/);
    assert.throws(() => parseRelativeTime('P0D'), /invalid/);
  });
});
```

---

## Step 2: 创建实现 `app/lib/relativeTimeParser.ts`

```typescript
/**
 * 简化版 ISO 8601 持续时间解析。
 * 支持：
 *   PnD  - n 天前
 *   PnH  - n 小时前
 *   PnM  - n 个月前（按 30 天近似）
 *   PTnM - n 分钟前
 *
 * 不支持：年/周/混合（如 P1Y2M）。
 */

const RE_DAYS    = /^P(\d+)D$/;
const RE_HOURS   = /^P(\d+)H$/;
const RE_MONTHS  = /^P(\d+)M$/;
const RE_MINUTES = /^PT(\d+)M$/;

export function isRelativeTimeExpr(s: string): boolean {
  if (typeof s !== 'string') return false;
  return RE_DAYS.test(s) || RE_HOURS.test(s) || RE_MONTHS.test(s) || RE_MINUTES.test(s);
}

export function parseRelativeTime(s: string, now: Date = new Date()): Date {
  let m: RegExpExecArray | null;

  m = RE_DAYS.exec(s);
  if (m) {
    const n = Number(m[1]);
    if (n <= 0) throw new Error(`invalid relative time: ${s}`);
    return new Date(now.getTime() - n * 86400_000);
  }

  m = RE_HOURS.exec(s);
  if (m) {
    const n = Number(m[1]);
    if (n <= 0) throw new Error(`invalid relative time: ${s}`);
    return new Date(now.getTime() - n * 3600_000);
  }

  m = RE_MONTHS.exec(s);
  if (m) {
    const n = Number(m[1]);
    if (n <= 0) throw new Error(`invalid relative time: ${s}`);
    return new Date(now.getTime() - n * 30 * 86400_000);
  }

  m = RE_MINUTES.exec(s);
  if (m) {
    const n = Number(m[1]);
    if (n <= 0) throw new Error(`invalid relative time: ${s}`);
    return new Date(now.getTime() - n * 60_000);
  }

  throw new Error(`invalid relative time: ${s}`);
}
```

---

## Step 3: 验证

```bash
npm test -- --testPathPattern=relative-time-parser
```

预期：6/6 PASS。

---

## Step 4: Commit

```bash
git add super-tool-node/app/lib/relativeTimeParser.ts super-tool-node/test/notification/lib/relative-time-parser.test.ts
git commit -m "feat(notification): add relative time parser (P{N}D / P{N}H / P{N}M / PT{N}M)

- isRelativeTimeExpr: bool check for ISO 8601 simplified syntax
- parseRelativeTime: returns Date offset from now
- Months approximated as 30 days (good enough for member.expire_at use case)
- 6 unit tests

Refs: docs/analysis/通知推送系统模块设计需求文档.md (V2 §4.2.4)
Plan: docs/superpowers/plans/2026-06-06-notification-p2-3-dynamic-audience.md (Task 2)"
```

---

## Verification Checklist

- [ ] 4 种时间格式都能解析
- [ ] 6 用例全 PASS
- [ ] commit 已提交

完成后进入 [`p2-3-03-whitelist.md`](./p2-3-03-whitelist.md)。
