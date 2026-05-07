import {
  getAccessToken,
  setAccessToken,
  getRefreshToken,
  setRefreshToken,
  getSessionId,
  setSessionId,
  setAuth,
  clearAuth,
  isAuthenticated,
  setCurrentUser,
  getCurrentUser,
} from '@/utils/authority';

describe('authority 权限工具', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('Token 管理', () => {
    it('初始状态应返回 null', () => {
      expect(getAccessToken()).toBeNull();
      expect(getRefreshToken()).toBeNull();
      expect(getSessionId()).toBeNull();
    });

    it('应正确存取 AccessToken', () => {
      setAccessToken('test-access-token');
      expect(getAccessToken()).toBe('test-access-token');
    });

    it('应正确存取 RefreshToken', () => {
      setRefreshToken('test-refresh-token');
      expect(getRefreshToken()).toBe('test-refresh-token');
    });

    it('应正确存取 SessionId', () => {
      setSessionId('test-session-id');
      expect(getSessionId()).toBe('test-session-id');
    });
  });

  describe('setAuth / clearAuth', () => {
    it('setAuth 应一次性保存所有认证信息', () => {
      setAuth({
        accessToken: 'at-123',
        refreshToken: 'rt-456',
        sessionId: 'sid-789',
      });

      expect(getAccessToken()).toBe('at-123');
      expect(getRefreshToken()).toBe('rt-456');
      expect(getSessionId()).toBe('sid-789');
    });

    it('clearAuth 应清除所有认证信息', () => {
      setAuth({
        accessToken: 'at-123',
        refreshToken: 'rt-456',
        sessionId: 'sid-789',
      });
      setCurrentUser({ id: 1, username: 'test' });

      clearAuth();

      expect(getAccessToken()).toBeNull();
      expect(getRefreshToken()).toBeNull();
      expect(getSessionId()).toBeNull();
      expect(getCurrentUser()).toBeNull();
    });
  });

  describe('isAuthenticated', () => {
    it('未登录时应返回 false', () => {
      expect(isAuthenticated()).toBe(false);
    });

    it('有 Token 时应返回 true', () => {
      setAccessToken('some-token');
      expect(isAuthenticated()).toBe(true);
    });

    it('清除 Token 后应返回 false', () => {
      setAccessToken('some-token');
      clearAuth();
      expect(isAuthenticated()).toBe(false);
    });
  });

  describe('用户信息管理', () => {
    it('初始应返回 null', () => {
      expect(getCurrentUser()).toBeNull();
    });

    it('应正确存取用户信息', () => {
      const user = { id: 1, username: 'admin', nickname: '管理员', email: 'admin@test.com' };
      setCurrentUser(user);
      expect(getCurrentUser()).toEqual(user);
    });

    it('JSON 解析失败应返回 null', () => {
      localStorage.setItem('super_tools_current_user', 'invalid-json');
      expect(getCurrentUser()).toBeNull();
    });
  });
});
