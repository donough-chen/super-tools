const TOKEN_KEY = 'super_tools_access_token';
const REFRESH_TOKEN_KEY = 'super_tools_refresh_token';
const SESSION_ID_KEY = 'super_tools_session_id';
const USER_KEY = 'super_tools_current_user';

/** 获取 AccessToken */
export function getAccessToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

/** 设置 AccessToken */
export function setAccessToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

/** 获取 RefreshToken */
export function getRefreshToken(): string | null {
  return localStorage.getItem(REFRESH_TOKEN_KEY);
}

/** 设置 RefreshToken */
export function setRefreshToken(token: string): void {
  localStorage.setItem(REFRESH_TOKEN_KEY, token);
}

/** 获取 SessionId */
export function getSessionId(): string | null {
  return localStorage.getItem(SESSION_ID_KEY);
}

/** 设置 SessionId */
export function setSessionId(id: string): void {
  localStorage.setItem(SESSION_ID_KEY, id);
}

/** 保存登录凭证 */
export function setAuth(data: {
  accessToken: string;
  refreshToken: string;
  sessionId: string;
}): void {
  setAccessToken(data.accessToken);
  setRefreshToken(data.refreshToken);
  setSessionId(data.sessionId);
}

/** 清除所有认证信息 */
export function clearAuth(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  localStorage.removeItem(SESSION_ID_KEY);
  localStorage.removeItem(USER_KEY);
}

/** 判断是否已登录 */
export function isAuthenticated(): boolean {
  return !!getAccessToken();
}

/** 保存当前用户信息 */
export function setCurrentUser(user: any): void {
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

/** 获取当前用户信息 */
export function getCurrentUser(): any | null {
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
