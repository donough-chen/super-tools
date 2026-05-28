/* eslint-disable no-console */
/**
 * Plan A · Task A7 + A8 验证脚本
 *  运行: npx ts-node --transpile-only scripts/check-a7-a8.ts
 *
 *  策略：
 *    A7 — 静态校验 router.ts 的 enforce + clearRuleCache 路由
 *    A8 — 用 Object.create(prototype) 直接调 clearRuleCache，覆盖 4 个核心场景：
 *      1) 不传 levelId → invalidateCache() 入参为 undefined
 *      2) query.levelId=2 → invalidateCache(2)
 *      3) body.levelId=3 → invalidateCache(3)
 *      4) levelId='abc' → ctx.throw(400)
 */
import * as fs from 'fs';
import * as path from 'path';
import AdminPointsOpsController from '../app/controller/admin/pointsOps';

interface MockState {
  invalidateCalls: any[];
  successPayload?: any;
  thrownStatus?: number;
  thrownMsg?: string;
}

function makeCtl(state: MockState, opts: { query?: any; body?: any } = {}): any {
  const ctl = Object.create(AdminPointsOpsController.prototype);
  ctl.ctx = {
    query: opts.query || {},
    request: { body: opts.body || {} },
    service: {
      pointsRule: {
        invalidateCache: async (lvl?: number) => {
          state.invalidateCalls.push(lvl);
        },
      },
    },
    throw: (status: number, msg: string) => {
      state.thrownStatus = status;
      state.thrownMsg = msg;
      const e: any = new Error(msg);
      e.status = status;
      throw e;
    },
  };
  // success 来自 BaseController；这里 mock 回写到 state
  (ctl as any).success = (data: any) => { state.successPayload = data; };
  return ctl;
}

async function run() {
  const cases: { name: string; fn: () => Promise<void> }[] = [];

  // ===== A7 静态校验 =====
  cases.push({
    name: 'A7 router.ts: 3 个写入路由使用 idemEnforced',
    fn: async () => {
      const text = fs.readFileSync(
        path.join(__dirname, '..', 'app', 'router.ts'),
        'utf8',
      );
      const enforces = (text.match(/idemEnforced/g) || []).length;
      // 1 处声明 + 3 处使用 sign/claim/exchange + 1 处注释 = 至少 4
      if (enforces < 4) throw new Error(`expected idemEnforced >= 4 occurrences, got ${enforces}`);
      // sign / claim / exchange 三个路由必须含 idemEnforced
      const lines = text.split('\n');
      const findRoute = (re: RegExp) => lines.find(l => re.test(l));
      const signLine = findRoute(/router\.post\('\/api\/sign'/);
      const claimLine = findRoute(/router\.post\('\/api\/tasks\/:code\/claim'/);
      const exchLine = findRoute(/router\.post\('\/api\/points-mall\/exchange'/);
      if (!signLine || !signLine.includes('idemEnforced')) throw new Error('sign route missing idemEnforced');
      if (!claimLine || !claimLine.includes('idemEnforced')) throw new Error('claim route missing idemEnforced');
      if (!exchLine || !exchLine.includes('idemEnforced')) throw new Error('exchange route missing idemEnforced');
    },
  });

  cases.push({
    name: 'A7 router.ts: clearRuleCache 路由已注册',
    fn: async () => {
      const text = fs.readFileSync(
        path.join(__dirname, '..', 'app', 'router.ts'),
        'utf8',
      );
      if (!/router\.post\('\/api\/admin\/points\/cache\/clear'/.test(text)) {
        throw new Error('clear-cache route not found');
      }
      if (!/clearRuleCache/.test(text)) {
        throw new Error('clearRuleCache action ref missing');
      }
    },
  });

  // ===== A8 单元行为 =====
  cases.push({
    name: 'A8 不传 levelId → invalidateCache(undefined) 清全部',
    fn: async () => {
      const s: MockState = { invalidateCalls: [] };
      const ctl = makeCtl(s);
      await ctl.clearRuleCache();
      if (s.invalidateCalls.length !== 1) throw new Error('should call once');
      if (s.invalidateCalls[0] !== undefined) {
        throw new Error(`expected undefined, got ${s.invalidateCalls[0]}`);
      }
      if (s.successPayload?.cleared !== true) throw new Error('cleared must be true');
      if (s.successPayload?.levelId !== 'all') throw new Error("levelId should be 'all'");
    },
  });

  cases.push({
    name: 'A8 query.levelId=2 → invalidateCache(2)',
    fn: async () => {
      const s: MockState = { invalidateCalls: [] };
      const ctl = makeCtl(s, { query: { levelId: '2' } });
      await ctl.clearRuleCache();
      if (s.invalidateCalls[0] !== 2) throw new Error(`got ${s.invalidateCalls[0]}`);
      if (s.successPayload?.levelId !== 2) throw new Error('payload levelId mismatch');
    },
  });

  cases.push({
    name: 'A8 body.levelId=3 → invalidateCache(3)',
    fn: async () => {
      const s: MockState = { invalidateCalls: [] };
      const ctl = makeCtl(s, { body: { levelId: 3 } });
      await ctl.clearRuleCache();
      if (s.invalidateCalls[0] !== 3) throw new Error(`got ${s.invalidateCalls[0]}`);
    },
  });

  cases.push({
    name: 'A8 levelId=abc → 400',
    fn: async () => {
      const s: MockState = { invalidateCalls: [] };
      const ctl = makeCtl(s, { query: { levelId: 'abc' } });
      try {
        await ctl.clearRuleCache();
        throw new Error('should have thrown');
      } catch (e: any) {
        if (s.thrownStatus !== 400) throw new Error(`expected 400, got ${s.thrownStatus}`);
        if (!s.thrownMsg?.includes('levelId')) throw new Error('msg missing levelId');
      }
      if (s.invalidateCalls.length !== 0) throw new Error('should NOT call invalidateCache');
    },
  });

  cases.push({
    name: 'A8 levelId=0 → 400 (非正整数)',
    fn: async () => {
      const s: MockState = { invalidateCalls: [] };
      const ctl = makeCtl(s, { query: { levelId: '0' } });
      try {
        await ctl.clearRuleCache();
        throw new Error('should have thrown');
      } catch (e: any) {
        if (s.thrownStatus !== 400) throw new Error(`expected 400, got ${s.thrownStatus}`);
      }
    },
  });

  cases.push({
    name: 'A8 levelId 空字符串 → 视为不传，清全部',
    fn: async () => {
      const s: MockState = { invalidateCalls: [] };
      const ctl = makeCtl(s, { query: { levelId: '' } });
      await ctl.clearRuleCache();
      if (s.invalidateCalls[0] !== undefined) throw new Error('should be undefined');
      if (s.successPayload?.levelId !== 'all') throw new Error("should be 'all'");
    },
  });

  let pass = 0, fail = 0;
  for (const c of cases) {
    try {
      await c.fn();
      console.log(`✅ ${c.name}`);
      pass++;
    } catch (err: any) {
      console.log(`❌ ${c.name}: ${err.message}`);
      fail++;
    }
  }
  console.log(`\nResult: ${pass} passed, ${fail} failed (total ${cases.length})`);
  process.exit(fail === 0 ? 0 : 1);
}

run().catch(err => { console.error(err); process.exit(2); });
