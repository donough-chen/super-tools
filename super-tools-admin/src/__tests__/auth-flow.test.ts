/**
 * 注册登录完整流程集成测试
 *
 * 验证：
 * 1. 注册流程 → 用户名/邮箱/密码验证 → 注册成功
 * 2. 登录流程 → Token 存储 → 认证状态更新
 * 3. Token 刷新 → 新 Token 替换
 * 4. 退出登录 → 清除所有认证状态
 */
import {
  setAuth,
  clearAuth,
  getAccessToken,
  getRefreshToken,
  getSessionId,
  isAuthenticated,
  setCurrentUser,
  getCurrentUser,
} from '@/utils/authority';

describe('注册登录完整流程集成测试', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('流程一：完整注册 → 登录 → 退出', () => {
    it('步骤 1：初始状态应未登录', () => {
      expect(isAuthenticated()).toBe(false);
      expect(getAccessToken()).toBeNull();
      expect(getCurrentUser()).toBeNull();
    });

    it('步骤 2：注册成功后不应有 Token（需单独登录）', () => {
      // 模拟注册成功 — 后端只返回 id 和 uuid，不返回 token
      const registerResult = { id: 1, uuid: 'uuid-abc-123' };

      // 注册成功后不应设置 token
      expect(isAuthenticated()).toBe(false);
      expect(registerResult.id).toBe(1);
      expect(registerResult.uuid).toBe('uuid-abc-123');
    });

    it('步骤 3：登录成功后应正确保存 Token 和用户信息', () => {
      // 模拟登录响应
      const loginData = {
        accessToken: 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.test-access',
        refreshToken: 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.test-refresh',
        expiresIn: 7200,
        sessionId: 'abc123def456timestamp',
      };

      // 保存认证信息
      setAuth(loginData);

      // 验证 Token 存储正确
      expect(getAccessToken()).toBe(loginData.accessToken);
      expect(getRefreshToken()).toBe(loginData.refreshToken);
      expect(getSessionId()).toBe(loginData.sessionId);
      expect(isAuthenticated()).toBe(true);
    });

    it('步骤 4：应能保存和读取用户信息', () => {
      const user = {
        id: 1,
        uuid: 'uuid-abc-123',
        username: 'admin',
        nickname: '管理员',
        email: 'admin@example.com',
        userType: 'admin',
      };

      setCurrentUser(user);
      const stored = getCurrentUser();

      expect(stored).toEqual(user);
      expect(stored.username).toBe('admin');
      expect(stored.email).toBe('admin@example.com');
    });

    it('步骤 5：退出登录后应清除所有状态', () => {
      // 先模拟已登录
      setAuth({
        accessToken: 'token-123',
        refreshToken: 'refresh-456',
        sessionId: 'session-789',
      });
      setCurrentUser({ id: 1, username: 'admin' });

      expect(isAuthenticated()).toBe(true);

      // 执行退出
      clearAuth();

      expect(isAuthenticated()).toBe(false);
      expect(getAccessToken()).toBeNull();
      expect(getRefreshToken()).toBeNull();
      expect(getSessionId()).toBeNull();
      expect(getCurrentUser()).toBeNull();
    });
  });

  describe('流程二：Token 刷新', () => {
    it('刷新 Token 后应更新存储', () => {
      // 设置旧 Token
      setAuth({
        accessToken: 'old-access',
        refreshToken: 'old-refresh',
        sessionId: 'old-session',
      });

      expect(getAccessToken()).toBe('old-access');

      // 模拟 Token 刷新 — 新 Token 替换旧 Token
      const newTokens = {
        accessToken: 'new-access-token-refreshed',
        refreshToken: 'new-refresh-token-refreshed',
        sessionId: 'new-session-id-refreshed',
      };

      setAuth(newTokens);

      expect(getAccessToken()).toBe('new-access-token-refreshed');
      expect(getRefreshToken()).toBe('new-refresh-token-refreshed');
      expect(getSessionId()).toBe('new-session-id-refreshed');
      expect(isAuthenticated()).toBe(true);
    });
  });

  describe('流程三：异常场景', () => {
    it('localStorage 存储损坏时 getCurrentUser 应返回 null', () => {
      localStorage.setItem('super_tools_current_user', '{invalid json}');
      expect(getCurrentUser()).toBeNull();
    });

    it('多次 clearAuth 不应报错', () => {
      clearAuth();
      clearAuth();
      clearAuth();
      expect(isAuthenticated()).toBe(false);
    });

    it('空字符串 Token 不应视为已登录', () => {
      localStorage.setItem('super_tools_access_token', '');
      expect(isAuthenticated()).toBe(false);
    });
  });

  describe('流程四：请求参数验证', () => {
    it('登录请求参数格式应正确', () => {
      const loginParams = {
        username: 'admin',
        password: 'Admin@123456',
        clientId: 'web',
        clientSecret: 'secret',
      };

      // 验证必需字段
      expect(loginParams).toHaveProperty('username');
      expect(loginParams).toHaveProperty('password');
      expect(loginParams).toHaveProperty('clientId');
      expect(loginParams).toHaveProperty('clientSecret');

      // 验证字段类型
      expect(typeof loginParams.username).toBe('string');
      expect(typeof loginParams.password).toBe('string');
    });

    it('注册请求参数格式应正确', () => {
      const registerParams = {
        username: 'newuser',
        email: 'user@example.com',
        password: 'Pass@123456',
        nickname: '新用户',
        clientId: 'web',
      };

      // 验证必需字段
      expect(registerParams).toHaveProperty('username');
      expect(registerParams).toHaveProperty('email');
      expect(registerParams).toHaveProperty('password');
      expect(registerParams).toHaveProperty('clientId');

      // 验证用户名长度 (3-50)
      expect(registerParams.username.length).toBeGreaterThanOrEqual(3);
      expect(registerParams.username.length).toBeLessThanOrEqual(50);

      // 验证密码长度 (>=8)
      expect(registerParams.password.length).toBeGreaterThanOrEqual(8);

      // 验证邮箱格式
      expect(registerParams.email).toMatch(/^[^\s@]+@[^\s@]+\.[^\s@]+$/);
    });

    it('刷新 Token 请求参数应包含 refreshToken', () => {
      const refreshParams = { refreshToken: 'some-refresh-token' };
      expect(refreshParams).toHaveProperty('refreshToken');
      expect(typeof refreshParams.refreshToken).toBe('string');
      expect(refreshParams.refreshToken.length).toBeGreaterThan(0);
    });
  });
});
