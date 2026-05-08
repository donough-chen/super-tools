// @ts-ignore
import { history } from 'umi';

/**
 * 跳转目标类型
 * - route    : 应用内路由（使用 umi history，支持 SPA 无刷新跳转）
 * - url      : 外部 URL（在新标签页打开）
 * - miniapp  : 微信小程序（通过 wx.miniProgram.navigateTo 跳转，需宿主环境支持）
 * - replace  : 应用内路由（替换当前历史记录，不产生新的历史条目）
 */
export type NavigateType = 'route' | 'url' | 'miniapp' | 'replace';

export interface NavigateOptions {
  /** 跳转目标，路由路径 / 完整 URL / 小程序页面路径 */
  target: string;
  /** 跳转类型，默认 'route' */
  type?: NavigateType;
  /** 路由跳转时携带的 state（仅 route / replace 有效） */
  state?: Record<string, unknown>;
  /** 外部 URL 打开方式，默认 '_blank'（仅 url 类型有效） */
  openTarget?: '_blank' | '_self';
  /** 微信小程序 appId（仅 miniapp 类型有效，不传则跳转当前小程序） */
  appId?: string;
}

/**
 * 通用跳转工具函数
 *
 * @example
 * // 应用内路由跳转
 * navigate({ target: '/settings' });
 *
 * // 外部链接（新标签页）
 * navigate({ target: 'https://example.com', type: 'url' });
 *
 * // 外部链接（当前页）
 * navigate({ target: 'https://example.com', type: 'url', openTarget: '_self' });
 *
 * // 替换当前路由（不产生历史记录）
 * navigate({ target: '/home', type: 'replace' });
 *
 * // 跳转微信小程序页面
 * navigate({ target: '/pages/index/index', type: 'miniapp' });
 *
 * // 跳转其他微信小程序
 * navigate({ target: '/pages/index/index', type: 'miniapp', appId: 'wx1234567890' });
 */
export function navigate(options: NavigateOptions): void {
  const { target, type = 'route', state, openTarget = '_blank', appId } = options;

  switch (type) {
    case 'route':
      history.push(target, state);
      break;

    case 'replace':
      history.replace(target, state);
      break;

    case 'url':
      window.open(target, openTarget, openTarget === '_blank' ? 'noopener,noreferrer' : undefined);
      break;

    case 'miniapp': {
      // 微信小程序环境：通过 JSSDK wx.miniProgram API 跳转
      const wx = (window as any).wx;
      if (wx?.miniProgram) {
        if (appId) {
          // 跳转到其他小程序
          wx.miniProgram.navigateToMiniProgram({
            appId,
            path: target,
            fail: (err: unknown) => {
              console.error('[navigate] 跳转小程序失败:', err);
            },
          });
        } else {
          // 跳转当前小程序页面
          wx.miniProgram.navigateTo({
            url: target,
            fail: (err: unknown) => {
              console.error('[navigate] 跳转小程序页面失败:', err);
            },
          });
        }
      } else {
        console.warn('[navigate] 当前环境不支持微信小程序跳转');
      }
      break;
    }

    default:
      console.warn(`[navigate] 未知的跳转类型: ${type}`);
  }
}

/**
 * 返回上一页
 * @param delta 回退步数，默认 1
 */
export function navigateBack(delta = 1): void {
  history.go(-delta);
}

/**
 * 跳转到应用内路由（navigate 的快捷方式）
 */
export function navigateTo(path: string, state?: Record<string, unknown>): void {
  navigate({ target: path, type: 'route', state });
}

/**
 * 替换当前路由（navigate 的快捷方式，不产生历史记录）
 */
export function navigateReplace(path: string, state?: Record<string, unknown>): void {
  navigate({ target: path, type: 'replace', state });
}

/**
 * 在新标签页打开外部链接（navigate 的快捷方式）
 */
export function openUrl(url: string, openTarget: '_blank' | '_self' = '_blank'): void {
  navigate({ target: url, type: 'url', openTarget });
}

/**
 * 获取当前路由 pathname
 * 供路由守卫 / 401 拦截等场景读取当前路径使用
 */
export function getCurrentPathname(): string {
  try {
    return history.location.pathname;
  } catch {
    return typeof window !== 'undefined' ? window.location.pathname : '/';
  }
}

/**
 * 获取当前路由完整 location 对象（pathname / search / query / state）
 * 注意：query 由 umi 注入，未开启 qs 解析时可能为 undefined
 */
export function getCurrentLocation(): {
  pathname: string;
  search: string;
  query?: Record<string, string | undefined>;
  state?: unknown;
} {
  try {
    const loc = history.location as any;
    return {
      pathname: loc.pathname,
      search: loc.search || '',
      query: loc.query,
      state: loc.state,
    };
  } catch {
    const w = typeof window !== 'undefined' ? window.location : null;
    return {
      pathname: w?.pathname || '/',
      search: w?.search || '',
    };
  }
}
