/**
 * 管理端 RBAC 缓存（sessionStorage）
 * - 关闭浏览器即失效
 * - 退出登录或 refreshRBAC 时手动清空
 */

const MENU_KEY = 'admin_menus';
const PERM_KEY = 'admin_permissions';

export function getCachedMenus(): MenuNode[] | null {
  try {
    const raw = sessionStorage.getItem(MENU_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setCachedMenus(m: MenuNode[]): void {
  try {
    sessionStorage.setItem(MENU_KEY, JSON.stringify(m));
  } catch {
    /* quota */
  }
}

export function getCachedPermissions(): string[] | null {
  try {
    const raw = sessionStorage.getItem(PERM_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setCachedPermissions(p: string[]): void {
  try {
    sessionStorage.setItem(PERM_KEY, JSON.stringify(p));
  } catch {
    /* quota */
  }
}

export function clearRbacCache(): void {
  sessionStorage.removeItem(MENU_KEY);
  sessionStorage.removeItem(PERM_KEY);
}
