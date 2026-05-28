/**
 * AuthService 业务事件埋点单测（B9 / spec §2.12-#34）
 *
 * 覆盖 3 处注册入口的 register 事件埋点：
 *   1. register()       — 账号密码注册
 *   2. phoneLogin()     — 手机号登录即注册（仅在 isNewUser=true 时 emit）
 *   3. wechatLogin()    — 微信登录即注册（仅在 oauthRecord 不存在时 emit）
 *
 * 测试约束：
 *   - 不依赖真实 DB / SMS / Wechat；用 jest mock 验证 emit 调用
 *   - emit 是同步 try/catch 范式（非 runInBackground），调 service 后立即可断言
 */

import AuthService from '../../../app/service/auth';
import { EVENT_CODES } from '../../../app/lib/eventCodes';

// 屏蔽 bcrypt 真算法以加速
jest.mock('bcryptjs', () => ({
  hash: jest.fn().mockResolvedValue('hashed'),
  compare: jest.fn().mockResolvedValue(true),
}));

function createMockCtx() {
  const baseCtx: any = {
    ip: '127.0.0.1',
    throw: jest.fn((status: number, msg: string) => {
      const e: any = new Error(msg);
      e.status = status;
      throw e;
    }),
    get: jest.fn(() => 'jest-ua'),
    model: {
      User: {
        findOne: jest.fn(),
        findByPk: jest.fn(),
        create: jest.fn(),
      },
      Role: { findOne: jest.fn().mockResolvedValue({ toJSON: () => ({ id: 2 }), id: 2 }) },
      UserRole: { create: jest.fn().mockResolvedValue({}) },
      UserProfile: { create: jest.fn().mockResolvedValue({}) },
      UserOauth: { findOne: jest.fn(), create: jest.fn().mockResolvedValue({}) },
      UserSession: { create: jest.fn().mockResolvedValue({}) },
      OauthClient: { findOne: jest.fn() },
      LoginLog: { create: jest.fn().mockResolvedValue({}) },
    },
    service: {
      event: { emit: jest.fn().mockResolvedValue(undefined) },
      member: { initMember: jest.fn().mockResolvedValue(undefined) },
      sms: { verifyCode: jest.fn().mockResolvedValue(true) },
      wechat: { login: jest.fn() },
      notification: { core: { sendDirect: jest.fn().mockResolvedValue({}), send: jest.fn().mockResolvedValue({}) } },
    },
    state: {},
    logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
  };
  return baseCtx;
}

function createService(ctx: any) {
  const svc: any = Object.create(AuthService.prototype);
  svc.ctx = ctx;
  // service 别名（auth.ts 内部用 this.service.X）
  svc.service = ctx.service;
  svc.app = {
    config: { jwt: { secret: 'test-secret' } },
    jwt: { sign: jest.fn(() => 'fake-token') },
    redis: {
      get: jest.fn().mockResolvedValue(null),
      incr: jest.fn().mockResolvedValue(1),
      expire: jest.fn().mockResolvedValue(1),
      del: jest.fn().mockResolvedValue(1),
      setex: jest.fn().mockResolvedValue(1),
    },
  };
  return svc;
}

describe('AuthService — register 事件埋点', () => {
  beforeEach(() => jest.clearAllMocks());

  // ===== Path 1: register() =====
  it('case1: 账号密码 register() 成功后 emit register 事件', async () => {
    const ctx = createMockCtx();
    const svc = createService(ctx);

    // 唯一性校验全部通过（findOne 返回 null）
    ctx.model.User.findOne.mockResolvedValue(null);
    ctx.model.User.create.mockResolvedValue({
      id: 42,
      uuid: 'uuid-42',
    });

    const result = await svc.register({
      username: 'alice',
      email: 'alice@example.com',
      password: 'P@ssw0rd123',
      clientId: 'web-client',
      platform: 'web',
    });

    expect(result).toEqual({ id: 42, uuid: 'uuid-42' });
    expect(ctx.service.event.emit).toHaveBeenCalledTimes(1);
    expect(ctx.service.event.emit).toHaveBeenCalledWith(
      EVENT_CODES.REGISTER,
      expect.objectContaining({
        userId: 42,
        source: 'web',
        registeredAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
      }),
    );
  });

  it('case2: register() emit 抛错不影响主流程（warn + 主结果正常）', async () => {
    const ctx = createMockCtx();
    const svc = createService(ctx);
    ctx.model.User.findOne.mockResolvedValue(null);
    ctx.model.User.create.mockResolvedValue({ id: 43, uuid: 'uuid-43' });
    ctx.service.event.emit.mockRejectedValue(new Error('event svc down'));

    const result = await svc.register({
      username: 'bob',
      email: 'bob@example.com',
      password: 'P@ss',
      clientId: 'web-client',
      platform: 'web',
    });

    expect(result).toEqual({ id: 43, uuid: 'uuid-43' });
    expect(ctx.logger.warn).toHaveBeenCalledWith(
      expect.stringMatching(/event emit register failed.*event svc down/),
    );
  });

  // ===== Path 2: phoneLogin() =====
  it('case3: phoneLogin() 新用户路径 emit register（source=phone_*）', async () => {
    const ctx = createMockCtx();
    const svc = createService(ctx);

    ctx.model.OauthClient.findOne.mockResolvedValue({
      toJSON: () => ({ clientId: 'h5-client', clientSecret: 'sec', accessTokenTtl: 86400, refreshTokenTtl: 2592000, platform: 'h5' }),
    });
    ctx.model.User.findOne.mockResolvedValue(null); // phone 未注册
    ctx.model.User.create.mockResolvedValue({
      id: 50,
      uuid: 'uuid-50',
      toJSON: () => ({ id: 50, uuid: 'uuid-50', phone: '13800138000', loginCount: 0 }),
      update: jest.fn(),
    });

    const result = await svc.phoneLogin({
      phone: '13800138000',
      code: '123456',
      clientId: 'h5-client',
      clientSecret: 'sec',
      platform: 'h5',
    });

    expect(result.isNewUser).toBe(true);
    expect(ctx.service.event.emit).toHaveBeenCalledWith(
      EVENT_CODES.REGISTER,
      expect.objectContaining({
        userId: 50,
        source: 'phone_h5',
        registeredAt: expect.any(String),
      }),
    );
    // DAILY_LOGIN 也应被调用（已存在埋点）
    expect(ctx.service.event.emit).toHaveBeenCalledWith(
      EVENT_CODES.DAILY_LOGIN,
      expect.objectContaining({ userId: 50 }),
    );
  });

  it('case4: phoneLogin() 老用户路径不 emit register（仅 daily_login）', async () => {
    const ctx = createMockCtx();
    const svc = createService(ctx);

    ctx.model.OauthClient.findOne.mockResolvedValue({
      toJSON: () => ({ clientId: 'h5-client', clientSecret: 'sec', accessTokenTtl: 86400, refreshTokenTtl: 2592000, platform: 'h5' }),
    });
    // phone 已存在的活跃账号
    ctx.model.User.findOne.mockResolvedValue({
      id: 51,
      status: 1,
      toJSON: () => ({ id: 51, uuid: 'uuid-51', phone: '13800138001', status: 1, loginCount: 3 }),
      update: jest.fn(),
    });

    await svc.phoneLogin({
      phone: '13800138001',
      code: '123456',
      clientId: 'h5-client',
      clientSecret: 'sec',
      platform: 'h5',
    });

    // 不应 emit register；只能 emit daily_login
    const emitCalls = ctx.service.event.emit.mock.calls.map((c: any[]) => c[0]);
    expect(emitCalls).not.toContain(EVENT_CODES.REGISTER);
    expect(emitCalls).toContain(EVENT_CODES.DAILY_LOGIN);
  });

  // ===== Path 3: wechatLogin() =====
  it('case5: wechatLogin() 新用户路径 emit register（source=wechat_*）', async () => {
    const ctx = createMockCtx();
    const svc = createService(ctx);

    ctx.model.OauthClient.findOne.mockResolvedValue({
      toJSON: () => ({ clientId: 'mp-client', clientSecret: 'sec', accessTokenTtl: 86400, refreshTokenTtl: 2592000, platform: 'miniprogram' }),
    });
    ctx.service.wechat.login.mockResolvedValue({
      openId: 'oABC123456',
      unionId: null,
      nickname: '微信小明',
      avatar: 'http://avatar',
      accessToken: 'wx-at',
      refreshToken: 'wx-rt',
      rawData: {},
    });
    ctx.model.UserOauth.findOne.mockResolvedValue(null); // 未绑定
    ctx.model.User.create.mockResolvedValue({
      id: 60,
      uuid: 'uuid-60',
      toJSON: () => ({ id: 60, uuid: 'uuid-60', nickname: '微信小明', loginCount: 0 }),
      update: jest.fn(),
    });

    const result = await svc.wechatLogin({
      code: 'wx-code',
      platform: 'miniprogram',
      clientId: 'mp-client',
      clientSecret: 'sec',
    });

    expect(result.isNewUser).toBe(true);
    expect(ctx.service.event.emit).toHaveBeenCalledWith(
      EVENT_CODES.REGISTER,
      expect.objectContaining({
        userId: 60,
        source: 'wechat_miniprogram',
        registeredAt: expect.any(String),
      }),
    );
  });

  it('case6: wechatLogin() 老用户路径不 emit register（仅 daily_login）', async () => {
    const ctx = createMockCtx();
    const svc = createService(ctx);

    ctx.model.OauthClient.findOne.mockResolvedValue({
      toJSON: () => ({ clientId: 'mp-client', clientSecret: 'sec', accessTokenTtl: 86400, refreshTokenTtl: 2592000, platform: 'miniprogram' }),
    });
    ctx.service.wechat.login.mockResolvedValue({
      openId: 'oABC',
      unionId: 'uABC',
      nickname: '老用户',
      avatar: '',
      accessToken: 'at',
      refreshToken: 'rt',
      rawData: {},
    });
    // 已绑定
    ctx.model.UserOauth.findOne.mockResolvedValue({
      toJSON: () => ({ userId: 61, nickname: '老用户', avatar: '' }),
      update: jest.fn(),
    });
    ctx.model.User.findByPk.mockResolvedValue({
      id: 61,
      status: 1,
      toJSON: () => ({ id: 61, uuid: 'uuid-61', loginCount: 5 }),
      update: jest.fn(),
    });

    const result = await svc.wechatLogin({
      code: 'wx-code',
      platform: 'miniprogram',
      clientId: 'mp-client',
      clientSecret: 'sec',
    });

    expect(result.isNewUser).toBe(false);
    const emitCalls = ctx.service.event.emit.mock.calls.map((c: any[]) => c[0]);
    expect(emitCalls).not.toContain(EVENT_CODES.REGISTER);
    expect(emitCalls).toContain(EVENT_CODES.DAILY_LOGIN);
  });
});
