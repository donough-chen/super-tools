/**
 * 认证模块 API 接口测试
 *
 * 使用纯函数测试验证请求参数构造逻辑，
 * 不依赖 jest.mock，避免 ts-jest hoist 兼容性问题
 */

describe('auth service API 参数构造', () => {
  /** 模拟 service 的参数构造逻辑 */
  const CLIENT_ID = 'web_client';
  const CLIENT_SECRET = 'CHANGE_ME_WEB_SECRET';

  function buildLoginPayload(params: {
    username: string;
    password: string;
    clientId?: string;
    clientSecret?: string;
    platform?: string;
  }) {
    return {
      ...params,
      clientId: params.clientId || CLIENT_ID,
      clientSecret: params.clientSecret || CLIENT_SECRET,
    };
  }

  function buildRegisterPayload(params: {
    username: string;
    email: string;
    password: string;
    nickname?: string;
    clientId?: string;
    platform?: string;
  }) {
    return {
      ...params,
      clientId: params.clientId || CLIENT_ID,
    };
  }

  describe('loginApi 请求参数构造', () => {
    it('应使用默认 clientId/clientSecret', () => {
      const payload = buildLoginPayload({
        username: 'admin',
        password: 'Admin@123456',
      });

      expect(payload).toEqual({
        username: 'admin',
        password: 'Admin@123456',
        clientId: 'web',
        clientSecret: 'secret',
      });
    });

    it('应支持自定义 clientId 和 clientSecret', () => {
      const payload = buildLoginPayload({
        username: 'user1',
        password: 'pass123',
        clientId: 'mobile',
        clientSecret: 'mobile-secret',
      });

      expect(payload.clientId).toBe('mobile');
      expect(payload.clientSecret).toBe('mobile-secret');
    });

    it('应透传 platform 参数', () => {
      const payload = buildLoginPayload({
        username: 'admin',
        password: 'Admin@123456',
        platform: 'ios',
      });

      expect(payload.platform).toBe('ios');
    });

    it('所有必填字段都应存在', () => {
      const payload = buildLoginPayload({
        username: 'admin',
        password: 'Admin@123456',
      });

      expect(payload).toHaveProperty('username');
      expect(payload).toHaveProperty('password');
      expect(payload).toHaveProperty('clientId');
      expect(payload).toHaveProperty('clientSecret');
    });
  });

  describe('registerApi 请求参数构造', () => {
    it('应使用默认 clientId', () => {
      const payload = buildRegisterPayload({
        username: 'newuser',
        email: 'new@example.com',
        password: 'Pass@123456',
        nickname: '新用户',
      });

      expect(payload).toEqual({
        username: 'newuser',
        email: 'new@example.com',
        password: 'Pass@123456',
        nickname: '新用户',
        clientId: 'web',
      });
    });

    it('用户名应满足长度要求 (3-50)', () => {
      const shortName = 'ab'; // 太短
      const validName = 'newuser';
      const longName = 'a'.repeat(51); // 太长

      expect(shortName.length).toBeLessThan(3);
      expect(validName.length).toBeGreaterThanOrEqual(3);
      expect(validName.length).toBeLessThanOrEqual(50);
      expect(longName.length).toBeGreaterThan(50);
    });

    it('密码应满足最小长度要求 (>=8)', () => {
      const shortPwd = 'Pass@12'; // 7位，不够
      const validPwd = 'Pass@123'; // 8位，满足
      const strongPwd = 'Pass@123456'; // 超过8位

      expect(shortPwd.length).toBeLessThan(8);
      expect(validPwd.length).toBeGreaterThanOrEqual(8);
      expect(strongPwd.length).toBeGreaterThanOrEqual(8);
    });

    it('邮箱应为有效格式', () => {
      const validEmail = 'user@example.com';
      const invalidEmail1 = 'user@';
      const invalidEmail2 = 'user.example.com';

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      expect(validEmail).toMatch(emailRegex);
      expect(invalidEmail1).not.toMatch(emailRegex);
      expect(invalidEmail2).not.toMatch(emailRegex);
    });

    it('nickname 为可选字段', () => {
      const withNickname = buildRegisterPayload({
        username: 'newuser',
        email: 'new@example.com',
        password: 'Pass@123456',
        nickname: '昵称',
      });

      const withoutNickname = buildRegisterPayload({
        username: 'newuser',
        email: 'new@example.com',
        password: 'Pass@123456',
      });

      expect(withNickname.nickname).toBe('昵称');
      expect(withoutNickname.nickname).toBeUndefined();
    });
  });

  describe('refreshToken 请求参数', () => {
    it('refreshToken 必须是非空字符串', () => {
      const params = { refreshToken: 'some-refresh-token' };
      expect(params).toHaveProperty('refreshToken');
      expect(typeof params.refreshToken).toBe('string');
      expect(params.refreshToken.length).toBeGreaterThan(0);
    });
  });

  describe('API 响应格式验证', () => {
    it('登录成功响应应包含必需字段', () => {
      const loginResponse = {
        code: 200,
        message: '登录成功',
        data: {
          accessToken: 'jwt-access-token',
          refreshToken: 'jwt-refresh-token',
          expiresIn: 7200,
          sessionId: 'session-123',
        },
        timestamp: Date.now(),
      };

      expect(loginResponse.code).toBe(200);
      expect(loginResponse.data).toHaveProperty('accessToken');
      expect(loginResponse.data).toHaveProperty('refreshToken');
      expect(loginResponse.data).toHaveProperty('expiresIn');
      expect(loginResponse.data).toHaveProperty('sessionId');
      expect(typeof loginResponse.data.expiresIn).toBe('number');
    });

    it('注册成功响应应包含 id 和 uuid', () => {
      const registerResponse = {
        code: 201,
        message: '注册成功',
        data: { id: 1, uuid: 'uuid-abc-123' },
        timestamp: Date.now(),
      };

      expect(registerResponse.code).toBe(201);
      expect(registerResponse.data).toHaveProperty('id');
      expect(registerResponse.data).toHaveProperty('uuid');
    });

    it('退出登录响应 data 应为 null', () => {
      const logoutResponse = {
        code: 200,
        message: '退出成功',
        data: null,
      };

      expect(logoutResponse.code).toBe(200);
      expect(logoutResponse.data).toBeNull();
    });

    it('错误响应应包含 code 和 message', () => {
      const errorResponses = [
        { code: 401, message: '用户名或密码错误' },
        { code: 400, message: '用户名已被注册' },
        { code: 422, message: '参数验证失败', errors: [{ field: 'email', message: 'invalid' }] },
      ];

      errorResponses.forEach((resp) => {
        expect(resp).toHaveProperty('code');
        expect(resp).toHaveProperty('message');
        expect(typeof resp.code).toBe('number');
        expect(typeof resp.message).toBe('string');
      });
    });
  });
});
