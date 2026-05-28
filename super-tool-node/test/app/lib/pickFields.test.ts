/* eslint-disable @typescript-eslint/no-var-requires */
/**
 * Unit tests for app/lib/pickFields
 *
 * Coverage:
 *   - source non-object inputs (null/undefined/primitives) -> {}
 *   - whitelist filtering (only-listed keys retained)
 *   - missing whitelist key -> not present in result (no undefined leakage)
 *   - falsy values preserved (0/false/null/'')
 *   - prototype chain props NOT picked
 *   - non-mutation guarantee (original source untouched)
 *
 * Note: ASCII-only + ESM import to avoid TS script-mode global const collisions
 *       with other test files (no isolatedModules), consistent with B4/B5 style.
 */
import * as assertB7 from 'assert';
import { pickFields } from '../../../app/lib/pickFields';

describe('lib/pickFields - B7 admin field whitelist utility', () => {
  it('returns {} when source is null', () => {
    assertB7.deepStrictEqual(pickFields(null, ['a']), {});
  });

  it('returns {} when source is undefined', () => {
    assertB7.deepStrictEqual(pickFields(undefined, ['a']), {});
  });

  it('returns {} when source is a primitive (number/string/boolean)', () => {
    assertB7.deepStrictEqual(pickFields(42 as any, ['a']), {});
    assertB7.deepStrictEqual(pickFields('hi' as any, ['a']), {});
    assertB7.deepStrictEqual(pickFields(false as any, ['a']), {});
  });

  it('keeps only whitelisted fields', () => {
    const r = pickFields({ a: 1, b: 2, c: 3 }, ['a', 'b']);
    assertB7.deepStrictEqual(r, { a: 1, b: 2 });
  });

  it('does not introduce undefined for missing whitelist keys', () => {
    const r = pickFields({ a: 1 }, ['a', 'b']);
    assertB7.deepStrictEqual(r, { a: 1 });
    assertB7.strictEqual('b' in r, false, 'missing key must not be present');
  });

  it('preserves falsy values (0, false, null, empty string)', () => {
    const r = pickFields(
      { a: 0, b: false, c: null, d: '', e: 'x' },
      ['a', 'b', 'c', 'd'],
    );
    assertB7.deepStrictEqual(r, { a: 0, b: false, c: null, d: '' });
  });

  it('does not pick keys from prototype chain (Object.create scenario)', () => {
    // Set up: create an object whose `inherited` lives on the prototype
    const proto = { inherited: 'should-not-pick' };
    const child = Object.create(proto);
    child.own = 'should-pick';
    const r: any = pickFields(child, ['own', 'inherited']);
    assertB7.strictEqual(r.own, 'should-pick');
    assertB7.strictEqual(
      'inherited' in r,
      false,
      'prototype-chain keys must not be picked (hasOwnProperty guard)',
    );
  });

  it('rejects keys defined only on prototype (Object.prototype.hasOwnProperty guard)', () => {
    // Simulate prototype pollution: attach a fake field to Object.prototype
    (Object.prototype as any).__pickFields_polluted = 'evil';
    try {
      const r = pickFields({ a: 1 }, ['a', '__pickFields_polluted']);
      assertB7.deepStrictEqual(r, { a: 1 });
      // Use hasOwnProperty (own-key check); note: `in` would query the prototype chain
      // and would return true here precisely because we just polluted Object.prototype.
      assertB7.strictEqual(
        Object.prototype.hasOwnProperty.call(r, '__pickFields_polluted'),
        false,
        'prototype-only keys must not be picked as own properties',
      );
    } finally {
      delete (Object.prototype as any).__pickFields_polluted;
    }
  });

  it('does not mutate source object', () => {
    const src = { a: 1, b: 2, c: 3 };
    const snap = JSON.stringify(src);
    pickFields(src, ['a']);
    assertB7.strictEqual(JSON.stringify(src), snap);
  });

  it('handles empty whitelist gracefully', () => {
    assertB7.deepStrictEqual(pickFields({ a: 1, b: 2 }, []), {});
  });

  it('handles empty source object', () => {
    assertB7.deepStrictEqual(pickFields({}, ['a', 'b']), {});
  });

  describe('B7 admin/task whitelist scenario (simulated)', () => {
    const TASK_CREATE_FIELDS = [
      'code', 'name', 'icon', 'description', 'category',
      'triggerEvent', 'condition', 'progressType', 'progressTarget',
      'rewardPoints', 'rewardGrowth', 'resetCycle', 'dailyCapGroup',
      'requiredLevel', 'expireDays', 'sort', 'status',
    ] as const;

    it('rejects injected id / createdAt / arbitrary fields', () => {
      const malicious = {
        id: 99999,
        createdAt: new Date('1970-01-01'),
        updatedAt: new Date('1970-01-01'),
        evilFlag: true,
        // legit fields
        code: 'foo',
        name: 'X',
        triggerEvent: 'sign',
        status: 1,
      };
      const r: any = pickFields(malicious, TASK_CREATE_FIELDS);
      assertB7.strictEqual(r.id, undefined, 'id must not be picked');
      assertB7.strictEqual(r.createdAt, undefined, 'createdAt must not be picked');
      assertB7.strictEqual(r.updatedAt, undefined, 'updatedAt must not be picked');
      assertB7.strictEqual(r.evilFlag, undefined, 'unknown fields must not be picked');
      assertB7.strictEqual(r.code, 'foo');
      assertB7.strictEqual(r.name, 'X');
      assertB7.strictEqual(r.triggerEvent, 'sign');
      assertB7.strictEqual(r.status, 1);
    });

    it('UPDATE whitelist (without code) rejects code change', () => {
      const TASK_UPDATE_FIELDS = TASK_CREATE_FIELDS.filter(f => f !== 'code');
      const r: any = pickFields(
        { code: 'attempt-rename', name: 'NewName', status: 0 },
        TASK_UPDATE_FIELDS,
      );
      assertB7.strictEqual(r.code, undefined, 'code must not be settable on UPDATE');
      assertB7.strictEqual(r.name, 'NewName');
      assertB7.strictEqual(r.status, 0);
    });
  });

  describe('B8 admin/pointsMall whitelist scenario (simulated)', () => {
    const ITEM_FIELDS = [
      'name', 'icon', 'description', 'category',
      'costPoints', 'requiredLevel', 'isVirtual', 'fulfillConfig',
      'stock', 'dailyLimit', 'totalLimit',
      'validFrom', 'validTo', 'sort', 'status',
    ] as const;

    it('rejects injected id / userId / createdAt / arbitrary fields', () => {
      const malicious = {
        id: 99999,
        userId: 1,
        createdAt: new Date('1970-01-01'),
        updatedAt: new Date('1970-01-01'),
        evilFlag: true,
        // legit fields
        name: 'Card',
        category: 'virtual',
        costPoints: 100,
        fulfillConfig: { kind: 'auto' },
        stock: 50,
        status: 1,
      };
      const r: any = pickFields(malicious, ITEM_FIELDS);
      assertB7.strictEqual(r.id, undefined, 'id must not be picked');
      assertB7.strictEqual(r.userId, undefined, 'userId must not be picked');
      assertB7.strictEqual(r.createdAt, undefined, 'createdAt must not be picked');
      assertB7.strictEqual(r.updatedAt, undefined, 'updatedAt must not be picked');
      assertB7.strictEqual(r.evilFlag, undefined, 'unknown fields must not be picked');
      assertB7.strictEqual(r.name, 'Card');
      assertB7.strictEqual(r.category, 'virtual');
      assertB7.strictEqual(r.costPoints, 100);
      assertB7.deepStrictEqual(r.fulfillConfig, { kind: 'auto' });
      assertB7.strictEqual(r.stock, 50);
      assertB7.strictEqual(r.status, 1);
    });

    it('UPDATE shares same whitelist as CREATE (no immutable business key)', () => {
      // mall_items has only auto-increment id; no task.code-like immutable key.
      // So CREATE and UPDATE legitimately share ITEM_FIELDS.
      const r: any = pickFields(
        { name: 'Renamed', costPoints: 200, isVirtual: true },
        ITEM_FIELDS,
      );
      assertB7.strictEqual(r.name, 'Renamed');
      assertB7.strictEqual(r.costPoints, 200);
      assertB7.strictEqual(r.isVirtual, true);
    });

    it('preserves complex fulfillConfig object intact', () => {
      const cfg = {
        kind: 'coupon',
        provider: 'meituan',
        params: { skuId: 'A-001', region: ['BJ', 'SH'] },
      };
      const r: any = pickFields(
        { name: 'X', category: 'c', costPoints: 1, fulfillConfig: cfg },
        ITEM_FIELDS,
      );
      assertB7.deepStrictEqual(r.fulfillConfig, cfg);
      // reference identity preserved (no deep clone)
      assertB7.strictEqual(r.fulfillConfig, cfg);
    });
  });
});
