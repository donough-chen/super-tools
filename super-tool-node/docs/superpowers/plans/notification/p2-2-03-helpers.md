# P2.2-03：rruleHelper + cronHelper + 测试（Task 3）

> 父计划：[2026-05-30-notification-p2-2-task-schedule.md](./2026-05-30-notification-p2-2-task-schedule.md)
> 前置：Task 1（依赖已装）

---

## Step 1: 创建 `app/lib/rruleHelper.ts`

```typescript
import { RRule, rrulestr } from 'rrule';
import { NOTIF_ERR } from '../constants/errorCodes';

/**
 * 校验 + 解析 rrule 字符串。
 * 接受形如 "FREQ=DAILY;BYHOUR=9;BYMINUTE=0" 或 "RRULE:FREQ=..."。
 */
export function parseRrule(rrule: string): RRule {
  try {
    const r = rrulestr(rrule, { forceset: false });
    if (r instanceof RRule) return r;
    // RRuleSet 单规则取第一个
    const sub = (r as any)._rrule?.[0];
    if (sub instanceof RRule) return sub;
    throw new Error('multi-rule sets are not supported');
  } catch (e: any) {
    const err = new Error(`rrule invalid: ${e.message}`);
    (err as any).biz = NOTIF_ERR.TASK_RRULE_INVALID;
    throw err;
  }
}

export function nextFireFromRrule(rrule: string, after: Date = new Date()): Date | null {
  const r = parseRrule(rrule);
  const next = r.after(after, true); // inclusive=true 当 after 正好命中也返回
  return next;
}

export function previewRrule(rrule: string, count = 5, after: Date = new Date()): Date[] {
  const r = parseRrule(rrule);
  const list: Date[] = [];
  let cursor = after;
  for (let i = 0; i < count; i++) {
    const n = r.after(cursor, false);
    if (!n) break;
    list.push(n);
    cursor = n;
  }
  return list;
}

/** 校验 rrule 是否在 N 天内有触发；防止 BYYEAR=2099 之类长跨度规则 */
export function rruleHasFireWithin(rrule: string, days: number): boolean {
  const next = nextFireFromRrule(rrule);
  if (!next) return false;
  const limit = Date.now() + days * 86400_000;
  return next.getTime() <= limit;
}
```

---

## Step 2: 创建 `app/lib/cronHelper.ts`

```typescript
import parser from 'cron-parser';
import { NOTIF_ERR } from '../constants/errorCodes';

export function validateCron(cron: string): void {
  try {
    parser.parseExpression(cron);
  } catch (e: any) {
    const err = new Error(`cron invalid: ${e.message}`);
    (err as any).biz = NOTIF_ERR.TASK_NOT_FOUND; // 复用占位；正式应为 108304
    (err as any).biz = { code: 108304, message: 'Cron 表达式非法' };
    throw err;
  }
}

export function nextFireFromCron(cron: string, after: Date = new Date()): Date {
  validateCron(cron);
  const it = parser.parseExpression(cron, { currentDate: after });
  return it.next().toDate();
}

export function previewCron(cron: string, count = 5, after: Date = new Date()): Date[] {
  validateCron(cron);
  const it = parser.parseExpression(cron, { currentDate: after });
  const list: Date[] = [];
  for (let i = 0; i < count; i++) list.push(it.next().toDate());
  return list;
}
```

---

## Step 3: 创建测试 `test/notification/lib/rrule-helper.test.ts`（5 用例）

```typescript
import { strict as assert } from 'assert';
import { parseRrule, nextFireFromRrule, previewRrule, rruleHasFireWithin } from '../../../app/lib/rruleHelper';

describe('lib/rruleHelper', () => {
  it('parseRrule 接受 FREQ=DAILY 形式', () => {
    const r = parseRrule('FREQ=DAILY;BYHOUR=9;BYMINUTE=0');
    assert.equal(r.options.freq, 3); // RRule.DAILY = 3
  });

  it('parseRrule 接受 RRULE: 前缀', () => {
    const r = parseRrule('RRULE:FREQ=WEEKLY;BYDAY=MO');
    assert.equal(r.options.freq, 2); // RRule.WEEKLY = 2
  });

  it('parseRrule 非法字符串抛带 biz 的错误', () => {
    try {
      parseRrule('NOT_A_RULE');
      assert.fail('should throw');
    } catch (e: any) {
      assert.ok(e.biz);
      assert.equal(e.biz.code, 108310);
    }
  });

  it('previewRrule 返回未来 5 次触发', () => {
    const list = previewRrule('FREQ=DAILY', 5, new Date('2026-06-01T00:00:00Z'));
    assert.equal(list.length, 5);
    for (let i = 1; i < list.length; i++) {
      assert.ok(list[i].getTime() > list[i - 1].getTime());
    }
  });

  it('rruleHasFireWithin 365 天内 DAILY 必有 → true', () => {
    assert.equal(rruleHasFireWithin('FREQ=DAILY', 365), true);
  });
});
```

---

## Step 4: 创建测试 `test/notification/lib/cron-helper.test.ts`（4 用例）

```typescript
import { strict as assert } from 'assert';
import { validateCron, nextFireFromCron, previewCron } from '../../../app/lib/cronHelper';

describe('lib/cronHelper', () => {
  it('validateCron 标准 5 段表达式不抛', () => {
    assert.doesNotThrow(() => validateCron('0 9 * * *'));
  });

  it('validateCron 非法表达式抛 108304', () => {
    try {
      validateCron('not-a-cron');
      assert.fail();
    } catch (e: any) {
      assert.equal(e.biz?.code, 108304);
    }
  });

  it('nextFireFromCron 0 9 * * * 在 2026-06-01 08:00 后返回 09:00', () => {
    const next = nextFireFromCron('0 9 * * *', new Date('2026-06-01T08:00:00Z'));
    assert.equal(next.getUTCHours(), 9);
    assert.equal(next.getUTCMinutes(), 0);
  });

  it('previewCron 返回 5 次递增时间', () => {
    const list = previewCron('0 * * * *', 5, new Date('2026-06-01T00:00:00Z'));
    assert.equal(list.length, 5);
    assert.equal(list[1].getTime() - list[0].getTime(), 3600_000);
  });
});
```

---

## Step 5: 运行测试

```bash
npm test -- --testPathPattern='(rrule|cron)-helper'
```

预期：9 用例全 PASS（5 rrule + 4 cron）。

---

## Step 6: Commit

```bash
git add super-tool-node/app/lib/rruleHelper.ts super-tool-node/app/lib/cronHelper.ts super-tool-node/test/notification/lib/rrule-helper.test.ts super-tool-node/test/notification/lib/cron-helper.test.ts
git commit -m "feat(notification): add rrule/cron helpers (parse/next/preview/validate)

- rruleHelper: parseRrule/nextFireFromRrule/previewRrule/rruleHasFireWithin
- cronHelper: validateCron/nextFireFromCron/previewCron
- Both throw biz error (108310 / 108304) on invalid input
- 9 unit tests

Refs: docs/analysis/通知推送系统模块设计需求文档.md (V2 §6.6)
Plan: docs/superpowers/plans/2026-05-30-notification-p2-2-task-schedule.md (Task 3)"
```

---

## Verification Checklist

- [ ] 两个 helper 文件存在
- [ ] 9 用例全 PASS
- [ ] commit 已提交

完成后进入 [`p2-2-04-queue-worker.md`](./p2-2-04-queue-worker.md)。
