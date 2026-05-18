/** 黑名单路径（小写比较），登录后不允许 redirect 指向这些页面 */
const REDIRECT_BLACKLIST = ['/login', '/register'];

/**
 * 从 URL search 中解析安全的 redirect 目标
 * - 防御 open-redirect（必须是站内相对路径）
 * - 防御登录/注册页循环
 * - SSR / 测试环境兜底
 */
export function resolveSafeRedirect(): string {
  if (typeof window === 'undefined') return '/';
  const raw = new URLSearchParams(window.location.search).get('redirect');
  if (!raw) return '/';

  try {
    // 用当前 origin 作为 base 来解析，拒绝任何跨域跳转
    const resolved = new URL(raw, window.location.origin);
    // 如果解析后 origin 和当前不同（绝对 URL / protocol-relative），拒绝
    if (resolved.origin !== window.location.origin) return '/';
    const pathname = resolved.pathname.toLowerCase().replace(/\/+$/, '') || '/';
    if (REDIRECT_BLACKLIST.includes(pathname)) return '/';
    // 保留 path + search + hash（但 origin 已确认是同站）
    return resolved.pathname + resolved.search + resolved.hash;
  } catch {
    return '/';
  }
}
