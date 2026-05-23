/**
 * micro-tools 路由白名单
 *
 * 数据源：`routes.config.ts`（与 `.umirc.*.ts` 共享同一份路由数据）
 *   - 新增 / 下线页面只需修改 `routes.config.ts`
 *   - 本文件会自动从其派生出运行时白名单
 *
 * 维护约定：
 * 1. 不再手动列举页面路径；若页面不在 routes.config 内，会被拦截到 /404
 * 2. 对于动态路由（如 /tools/:code），在 `EXTRA_ROUTE_PREFIXES` 中登记前缀即可
 */
import { ALL_ROUTE_PATHS } from '../routes.config';

/**
 * 运行时已知精确路径（由 routes.config 派生 + 少量别名）
 */
export const KNOWN_ROUTES: readonly string[] = Array.from(
  new Set<string>([
    ...ALL_ROUTE_PATHS,
    // 静态资源/别名入口
    '/index.html',
  ]),
);

/**
 * 已知路由前缀（匹配该前缀下所有子路径）
 * - 后续若开放 `/tools/:code` 等动态路由，在这里登记即可
 * - 维护在这里而非 routes.config 的原因：动态路由通常不对应一个物理 page 文件
 */
export const EXTRA_ROUTE_PREFIXES: readonly string[] = [
  // '/tools/',
  '/member/orders/',         // /member/orders/:id 订单详情
  '/notifications/detail/',  // /notifications/detail/:id 消息详情
  '/feedback/detail/',       // /feedback/detail/:id 反馈详情
];

/** 兼容旧名保留导出（对外语义不变） */
export const KNOWN_ROUTE_PREFIXES = EXTRA_ROUTE_PREFIXES;

/** 兜底路径（未知路由统一跳转目标） */
export const FALLBACK_ROUTE = '/404';

/**
 * 规范化路径：去除 search / hash、去除末尾斜杠（根路径保留）
 */
function normalizePath(path: string): string {
  if (!path) return '/';
  // 绝对 URL 直接返回，本函数不处理（外链不应走路由白名单）
  if (/^https?:\/\//i.test(path)) return path;
  const pureA = path.split('#')[0];
  const pureB = pureA.split('?')[0];
  if (pureB.length > 1 && pureB.endsWith('/')) {
    return pureB.slice(0, -1);
  }
  return pureB || '/';
}

/**
 * 判断给定路径是否为已知路由
 *
 * @example
 * isKnownRoute('/profile')       // true
 * isKnownRoute('/profile?id=1')  // true（自动剥离 query）
 * isKnownRoute('/not-exist')     // false
 */
export function isKnownRoute(path: string): boolean {
  if (!path) return false;
  // 外链（http/https）跳过白名单检查，交由业务端决定如何打开
  if (/^https?:\/\//i.test(path)) return true;

  const normalized = normalizePath(path);

  // 精确匹配
  if (KNOWN_ROUTES.includes(normalized)) return true;

  // 前缀匹配
  return EXTRA_ROUTE_PREFIXES.some((prefix) => normalized.startsWith(prefix));
}
