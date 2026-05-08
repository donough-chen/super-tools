/**
 * 路由安全跳转工具（仅 micro-tools 端使用）
 *
 * 背景：
 *   工具/菜单的 path 由后端下发，前端路由可能尚未开发完成。
 *   直接 navigateTo 未注册路由会触发白屏（路由无匹配组件）。
 *
 * 策略：
 *   1. 跳转前用 isKnownRoute 预检目标路径
 *   2. 若不在白名单内，重定向到 FALLBACK_ROUTE（/404 功能开发中页面）
 *   3. 若为外链（http/https），直接放行 openUrl
 *
 * 用法：
 *   import { safeNavigate, safeNavigateReplace } from '../utils/safeNavigate';
 *   safeNavigate('/tools/xxx');      // 未注册 → 跳 /404
 *   safeNavigate('/profile');        // 已注册 → 正常跳转
 */
import { navigateTo, navigateReplace, openUrl } from '@/utils/navigator';
import { FALLBACK_ROUTE, isKnownRoute } from '../constants/routes';

/**
 * 判断路径是否为外部链接
 */
function isExternalUrl(path: string): boolean {
  return /^https?:\/\//i.test(path);
}

/**
 * 安全路由跳转（history.push 语义）
 *
 * - 外链 → openUrl 新窗口
 * - 已知路由 → navigateTo 正常跳转
 * - 未知路由 → navigateTo(FALLBACK_ROUTE) 跳兜底页
 *
 * @param path 目标路径
 * @param state 路由 state
 */
export function safeNavigate(path: string, state?: Record<string, unknown>): void {
  if (!path) {
    navigateTo(FALLBACK_ROUTE);
    return;
  }
  if (isExternalUrl(path)) {
    openUrl(path);
    return;
  }
  if (isKnownRoute(path)) {
    navigateTo(path, state);
    return;
  }
  // 未知路由：跳兜底页，保留原目标到 state 方便埋点
  if (process.env.NODE_ENV !== 'production') {
    // eslint-disable-next-line no-console
    console.warn(`[safeNavigate] 路由未注册，已重定向至 ${FALLBACK_ROUTE}：`, path);
  }
  navigateTo(FALLBACK_ROUTE, { from: path });
}

/**
 * 安全路由替换跳转（history.replace 语义）
 */
export function safeNavigateReplace(path: string, state?: Record<string, unknown>): void {
  if (!path) {
    navigateReplace(FALLBACK_ROUTE);
    return;
  }
  if (isExternalUrl(path)) {
    openUrl(path);
    return;
  }
  if (isKnownRoute(path)) {
    navigateReplace(path, state);
    return;
  }
  if (process.env.NODE_ENV !== 'production') {
    // eslint-disable-next-line no-console
    console.warn(`[safeNavigateReplace] 路由未注册，已重定向至 ${FALLBACK_ROUTE}：`, path);
  }
  navigateReplace(FALLBACK_ROUTE, { from: path });
}
