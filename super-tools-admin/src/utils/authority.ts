const TOKEN_KEY = 'super_tools_admin_access_token';
const REFRESH_TOKEN_KEY = 'super_tools_admin_refresh_token';
const SESSION_ID_KEY = 'super_tools_admin_session_id';
const USER_KEY = 'super_tools_admin_current_user';
const EXPIRES_AT_KEY = 'super_tools_admin_expires_at';

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

/** 获取 AccessToken 过期时间戳（毫秒） */
export function getExpiresAt(): number | null {
  const raw = localStorage.getItem(EXPIRES_AT_KEY);
  if (!raw) return null;
  const val = Number(raw);
  return isNaN(val) ? null : val;
}

/**
 * 判断 AccessToken 是否已过期（提前 60 秒视为过期，留出刷新窗口）
 * 若无过期记录，返回 false（不主动判断过期，由请求拦截器兜底）
 */
export function isTokenExpired(): boolean {
  const expiresAt = getExpiresAt();
  if (!expiresAt) return false;
  return Date.now() >= expiresAt - 60000;
}

/** 保存登录凭证 */
export function setAuth(data: {
  accessToken: string;
  refreshToken: string;
  sessionId: string;
  expiresIn?: number;
}): void {
  setAccessToken(data.accessToken);
  setRefreshToken(data.refreshToken);
  setSessionId(data.sessionId);
  if (data.expiresIn) {
    localStorage.setItem(EXPIRES_AT_KEY, String(Date.now() + data.expiresIn * 1000));
  }
}

/** 清除所有认证信息 */
export function clearAuth(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  localStorage.removeItem(SESSION_ID_KEY);
  localStorage.removeItem(USER_KEY);
  localStorage.removeItem(EXPIRES_AT_KEY);
}

/**
 * 判断是否已登录（token 存在且未过期）
 * 注意：过期后仍可能通过 RefreshToken 续期，此处仅作本地预检
 */
export function isAuthenticated(): boolean {
  return !!getAccessToken() && !isTokenExpired();
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
