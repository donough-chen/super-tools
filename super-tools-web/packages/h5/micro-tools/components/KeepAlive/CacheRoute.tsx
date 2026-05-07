/**
 * CacheRoute 路由缓存包装组件
 *
 * 在 UmiJS Layout 中集成 KeepAlive 逻辑：
 * 1. 监听路由变化（location.pathname）
 * 2. 根据缓存白名单决定是否缓存当前页面
 * 3. 将 Umi 的 children（当前路由组件）传递给 KeepAlive
 *
 * 设计原则：
 * - 一级页面（TabBar 页面）默认缓存 → 切换不闪烁
 * - 二级页面默认不缓存 → 返回时正常卸载/重建
 * - 支持通过 cacheRoutes 配置灵活扩展
 */
import React, { useMemo, useCallback, useRef, useEffect } from 'react';
import KeepAlive from './index';
import './KeepAlive.less';

/** 需要缓存的路由路径配置 */
export const CACHE_ROUTES = [
  '/',           // 首页
  '/favorites',  // 收藏
  '/featured',   // 特色
  '/sites',      // 网站
  '/mine',       // 我的
];

export interface CacheRouteProps {
  /** 当前路由路径 */
  pathname: string;
  /** Umi 注入的 children（当前路由匹配的页面组件） */
  children: React.ReactNode;
  /** 需要缓存的路由列表（可选，默认使用 CACHE_ROUTES） */
  cacheRoutes?: string[];
  /** 最大缓存页面数量 */
  maxCacheCount?: number;
}

/**
 * 规范化路径：去除末尾斜杠，保证 '/' 不变
 */
const normalizePath = (path: string): string => {
  if (path === '/') return path;
  return path.replace(/\/+$/, '');
};

const CacheRoute: React.FC<CacheRouteProps> = ({
  pathname,
  children,
  cacheRoutes = CACHE_ROUTES,
  maxCacheCount = 10,
}) => {
  const normalizedPath = useMemo(() => normalizePath(pathname), [pathname]);
  const prevPathRef = useRef<string>(normalizedPath);
  const pageContainerRef = useRef<HTMLDivElement>(null);

  // 路由切换时添加淡入动画
  useEffect(() => {
    if (prevPathRef.current !== normalizedPath && pageContainerRef.current) {
      const activePages = pageContainerRef.current.querySelectorAll(
        '.keep-alive__page',
      );
      activePages.forEach(page => {
        const el = page as HTMLElement;
        if (el.style.display !== 'none') {
          // 添加动画 class
          el.classList.remove('keep-alive__page--active-enter');
          // 强制触发 reflow 以重启动画
          void el.offsetWidth;
          el.classList.add('keep-alive__page--active-enter');
        }
      });
    }
    prevPathRef.current = normalizedPath;
  }, [normalizedPath]);

  // 页面激活回调：滚动到页面缓存位置（保持滚动位置）
  const handleActivate = useCallback((key: string) => {
    // 页面激活时不需要额外操作
    // 因为 DOM 被缓存，滚动位置天然保持
  }, []);

  return (
    <div ref={pageContainerRef} className="cache-route">
      <KeepAlive
        activeCacheKey={normalizedPath}
        include={cacheRoutes}
        maxCacheCount={maxCacheCount}
        onActivate={handleActivate}
      >
        {children}
      </KeepAlive>
    </div>
  );
};

export default CacheRoute;
