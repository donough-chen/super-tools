/* eslint-disable no-console */
/**
 * 一次性手测 event.ts 的 emit / dispatchInProcess / dispatchFromMessenger
 *  对应 Plan A · Task A5 验收
 *  运行: npx ts-node --transpile-only scripts/check-event-service.ts
 *
 *  策略：
 *    用 Object.create(EventService.prototype) 绕过 egg Service 构造函数，
 *    直接为 this.ctx / this.app 注入 mock，覆盖核心场景：
 *    1) emit 写 domain_events 表 status=emitted
 *    2) emit 触发 task.onEvent
 *    3) emit 触发 messenger.sendToApp
 *    4) DomainEvent.create 抛错 → 仅 logger.warn，不阻塞 dispatch + broadcast
 *    5) task.onEvent 抛错 → logger.error，不阻塞 broadcast
 *    6) dispatchFromMessenger 等价于 dispatchInProcess
 *    7) 未知 code → logger.warn 但流程继续
 */
import EventService from '../app/service/event';

interface MockState {
  warns: string[];
  errors: string[];
  domainEventCreates: any[];
  taskOnEventCalls: any[];
  messengerSendCalls: any[];
  shouldDomainEventCreateThrow?: boolean;
  shouldTaskOnEventThrow?: boolean;
  shouldMessengerThrow?: boolean;
}

function makeService(state: MockState): any {
  const svc = Object.create(EventService.prototype);
  svc.ctx = {
    model: {
      DomainEvent: {
        create: async (rec: any) => {
          if (state.shouldDomainEventCreateThrow) throw new Error('db down');
          state.domainEventCreates.push(rec);
          return rec;
        },
      },
    },
    service: {
      task: {
        onEvent: async (evt: any) => {
          if (state.shouldTaskOnEventThrow) throw new Error('task explosion');
          state.taskOnEventCalls.push(evt);
        },
      },
    },
    logger: {
      warn:  (msg: string) => state.warns.push(msg),
      error: (msg: string) => state.errors.push(msg),
    },
  };
  svc.app = {
    messenger: {
      sendToApp: (channel: string, evt: any) => {
        if (state.shouldMessengerThrow) throw new Error('messenger down');
        state.messengerSendCalls.push({ channel, evt });
      },
    },
  };
  return svc;
}

function fresh(): MockState {
  return {
    warns: [],
    errors: [],
    domainEventCreates: [],
    taskOnEventCalls: [],
    messengerSendCalls: [],
  };
}

async function run() {
  const cases: { name: string; fn: () => Promise<void> }[] = [];

  // CASE 1: 正常 emit → 三件事都发生
  cases.push({
    name: '正常 emit 写库 + 派发 + 广播',
    fn: async () => {
      const s = fresh();
      const svc = makeService(s);
      await svc.emit('sign', { userId: 42, streak: 3 });
      if (s.domainEventCreates.length !== 1) throw new Error(`db creates=${s.domainEventCreates.length}`);
      const rec = s.domainEventCreates[0];
      if (rec.eventCode !== 'sign' || rec.userId !== 42 || rec.status !== 'emitted') {
        throw new Error(`bad rec: ${JSON.stringify(rec)}`);
      }
      if (rec.payload.streak !== 3) throw new Error('payload missing streak');
      if (s.taskOnEventCalls.length !== 1) throw new Error('task.onEvent not called');
      if (s.taskOnEventCalls[0].code !== 'sign') throw new Error('task code mismatch');
      if (s.messengerSendCalls.length !== 1) throw new Error('messenger not called');
      if (s.messengerSendCalls[0].channel !== 'domain-event') throw new Error('wrong channel');
      if (s.warns.length !== 0) throw new Error(`unexpected warn: ${s.warns}`);
      if (s.errors.length !== 0) throw new Error(`unexpected error: ${s.errors}`);
    },
  });

  // CASE 2: DomainEvent.create 抛错 → 仅 warn，不阻塞 dispatch + messenger
  cases.push({
    name: 'DB 写库失败仅 warn 不阻塞',
    fn: async () => {
      const s = fresh();
      s.shouldDomainEventCreateThrow = true;
      const svc = makeService(s);
      await svc.emit('sign', { userId: 1 });
      if (s.warns.length === 0 || !s.warns[0].includes('db log failed')) {
        throw new Error(`expected db warn, got: ${s.warns}`);
      }
      if (s.taskOnEventCalls.length !== 1) throw new Error('dispatch should still happen');
      if (s.messengerSendCalls.length !== 1) throw new Error('messenger should still happen');
    },
  });

  // CASE 3: task.onEvent 抛错 → logger.error，不阻塞 messenger
  cases.push({
    name: 'task.onEvent 抛错 → error 但 messenger 继续',
    fn: async () => {
      const s = fresh();
      s.shouldTaskOnEventThrow = true;
      const svc = makeService(s);
      await svc.emit('tool_used', { userId: 7, tool_code: 'foo' });
      if (s.errors.length === 0 || !s.errors[0].includes('dispatch error')) {
        throw new Error(`expected dispatch error, got: ${JSON.stringify(s.errors)}`);
      }
      if (s.messengerSendCalls.length !== 1) throw new Error('messenger should still fire');
    },
  });

  // CASE 4: messenger 抛错 → 静默
  cases.push({
    name: 'messenger 抛错静默不影响业务',
    fn: async () => {
      const s = fresh();
      s.shouldMessengerThrow = true;
      const svc = makeService(s);
      await svc.emit('sign', { userId: 1 });
      // 写库 + 派发都正常完成
      if (s.domainEventCreates.length !== 1) throw new Error('db should write');
      if (s.taskOnEventCalls.length !== 1) throw new Error('dispatch should run');
      // 仅消费 messenger 的异常，不应进入 warn/error
      // （当前实现是 catch + 静默，所以 errors 应该空）
      if (s.errors.length !== 0) throw new Error(`messenger err leaked: ${s.errors}`);
    },
  });

  // CASE 5: dispatchFromMessenger 行为等价 dispatchInProcess
  cases.push({
    name: 'dispatchFromMessenger 等价 dispatchInProcess',
    fn: async () => {
      const s = fresh();
      const svc = makeService(s);
      await svc.dispatchFromMessenger({ code: 'sign', userId: 1, payload: { userId: 1 }, ts: Date.now() });
      if (s.taskOnEventCalls.length !== 1) throw new Error('task.onEvent not called');
      // dispatchFromMessenger 不应再写库 / 再广播（避免重复）
      if (s.domainEventCreates.length !== 0) throw new Error('should NOT write DB on messenger receive');
      if (s.messengerSendCalls.length !== 0) throw new Error('should NOT re-broadcast on messenger receive');
    },
  });

  // CASE 6: 未知 code → logger.warn 但流程继续
  cases.push({
    name: '未知 event code → warn 但流程继续',
    fn: async () => {
      const s = fresh();
      const svc = makeService(s);
      await svc.emit('not_in_codes', { userId: 1 });
      if (s.warns.length === 0 || !s.warns[0].includes('unknown event code')) {
        throw new Error(`expected unknown warn, got: ${s.warns}`);
      }
      if (s.domainEventCreates.length !== 1) throw new Error('db should still write');
      if (s.taskOnEventCalls.length !== 1) throw new Error('dispatch should still run');
    },
  });

  // CASE 7: codes static 暴露常量
  cases.push({
    name: 'EventService.codes static 暴露 EVENT_CODES',
    fn: async () => {
      const c = (EventService as any).codes;
      if (!c || c.SIGN !== 'sign' || c.SIGN_STREAK !== 'sign_streak') {
        throw new Error(`bad codes: ${JSON.stringify(c)}`);
      }
    },
  });

  // CASE 8 (A6): emit 时 evt._pid = 当前 worker pid
  cases.push({
    name: 'A6 emit 时 evt._pid 标记当前 pid',
    fn: async () => {
      const s = fresh();
      const svc = makeService(s);
      await svc.emit('sign', { userId: 1 });
      const taskEvt = s.taskOnEventCalls[0];
      if (taskEvt._pid !== process.pid) {
        throw new Error(`expected _pid=${process.pid}, got ${taskEvt._pid}`);
      }
      const messengerEvt = s.messengerSendCalls[0].evt;
      if (messengerEvt._pid !== process.pid) {
        throw new Error(`messenger evt _pid wrong`);
      }
    },
  });

  // CASE 9 (A6): dispatchFromMessenger 收到自己 worker 的回声 → 跳过
  cases.push({
    name: 'A6 dispatchFromMessenger 跳过同 pid 自己的回声',
    fn: async () => {
      const s = fresh();
      const svc = makeService(s);
      await svc.dispatchFromMessenger({
        code: 'sign',
        userId: 1,
        payload: { userId: 1 },
        ts: Date.now(),
        _pid: process.pid, // 来自当前 worker 的回声
      });
      if (s.taskOnEventCalls.length !== 0) {
        throw new Error('should NOT dispatch when _pid === self');
      }
    },
  });

  // CASE 10 (A6): dispatchFromMessenger 收到其他 worker 的事件 → 派发
  cases.push({
    name: 'A6 dispatchFromMessenger 来自其他 worker 时派发',
    fn: async () => {
      const s = fresh();
      const svc = makeService(s);
      await svc.dispatchFromMessenger({
        code: 'sign',
        userId: 1,
        payload: { userId: 1 },
        ts: Date.now(),
        _pid: process.pid + 99999, // 假装来自其他 worker
      });
      if (s.taskOnEventCalls.length !== 1) {
        throw new Error('should dispatch when _pid is other worker');
      }
      if (s.domainEventCreates.length !== 0) throw new Error('should NOT write DB');
      if (s.messengerSendCalls.length !== 0) throw new Error('should NOT re-broadcast');
    },
  });

  // CASE 11 (A6): dispatchFromMessenger 收到无效 evt → 安全跳过
  cases.push({
    name: 'A6 dispatchFromMessenger 无效 evt 安全跳过',
    fn: async () => {
      const s = fresh();
      const svc = makeService(s);
      await svc.dispatchFromMessenger(null);
      await svc.dispatchFromMessenger({});
      await svc.dispatchFromMessenger({ userId: 1 } as any);
      if (s.taskOnEventCalls.length !== 0) throw new Error('should not dispatch invalid');
      if (s.errors.length !== 0) throw new Error(`unexpected error: ${s.errors}`);
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
