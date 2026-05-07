/**
 * KeepAlive 页面缓存组件
 *
 * 实现原理：
 * 1. 将已访问过的页面组件缓存到内存中（保持 React 组件树不卸载）
 * 2. 通过 CSS display:none 隐藏非活跃页面，而不是从 DOM 中移除
 * 3. 页面切换时仅改变可见性，保留页面状态（滚动位置、表单输入、展开状态等）
 *
 * 支持功能：
 * - 可配置缓存页面白名单（include）
 * - 可配置最大缓存数量（maxCacheCount），超出时按 LRU 策略清除
 * - 提供手动清除缓存方法（通过 KeepAliveContext）
 * - 页面激活/休眠生命周期回调（onActivate / onDeactivate）
 */
import React, {
  createContext,
  useContext,
  useRef,
  useState,
  useCallback,
  useEffect,
  useMemo,
} from 'react';

// ==================== 类型定义 ====================

export interface CacheEntry {
  /** 缓存键（通常为路由 path） */
  key: string;
  /** 缓存的 React 元素 */
  element: React.ReactNode;
  /** 缓存时间戳（用于 LRU 排序） */
  timestamp: number;
}

export interface KeepAliveContextValue {
  /** 清除指定页面缓存 */
  dropCache: (key: string) => void;
  /** 清除所有缓存 */
  dropAllCache: () => void;
  /** 获取当前缓存列表的 key */
  getCacheKeys: () => string[];
  /** 刷新指定页面（清除缓存后重新渲染） */
  refreshCache: (key: string) => void;
}

export interface KeepAliveProps {
  /** 当前激活的缓存 key（通常是 location.pathname） */
  activeCacheKey: string;
  /** 需要缓存的路由路径白名单，不在名单内的页面不会被缓存 */
  include: string[];
  /** 最大缓存数量，超过时按 LRU 清除最久未使用的 */
  maxCacheCount?: number;
  /** 当前路由对应的子节点（children） */
  children: React.ReactNode;
  /** 页面激活时的回调 */
  onActivate?: (key: string) => void;
  /** 页面休眠时的回调 */
  onDeactivate?: (key: string) => void;
}

// ==================== Context ====================

export const KeepAliveContext = createContext<KeepAliveContextValue>({
  dropCache: () => {},
  dropAllCache: () => {},
  getCacheKeys: () => [],
  refreshCache: () => {},
});

/** 在子组件中获取 KeepAlive 控制方法 */
export const useKeepAlive = () => useContext(KeepAliveContext);

// ==================== 组件实现 ====================

const KeepAlive: React.FC<KeepAliveProps> = ({
  activeCacheKey,
  include,
  maxCacheCount = 10,
  children,
  onActivate,
  onDeactivate,
}) => {
  // 缓存列表（使用 ref 以避免不必要的重渲染）
  const cacheListRef = useRef<CacheEntry[]>([]);
  // 用 state 驱动渲染更新
  const [cacheList, setCacheList] = useState<CacheEntry[]>([]);
  // 上一次激活的 key
  const prevKeyRef = useRef<string>('');

  // 判断是否需要缓存
  const shouldCache = useCallback(
    (key: string) => include.includes(key),
    [include],
  );

  // 更新缓存列表
  useEffect(() => {
    const currentKey = activeCacheKey;
    const prevKey = prevKeyRef.current;

    // 触发休眠回调
    if (prevKey && prevKey !== currentKey) {
      onDeactivate?.(prevKey);
    }

    // 判断当前页面是否需要缓存
    if (shouldCache(currentKey)) {
      const existingIndex = cacheListRef.current.findIndex(
        entry => entry.key === currentKey,
      );

      if (existingIndex > -1) {
        // 已有缓存：更新时间戳（LRU 提升优先级）
        cacheListRef.current[existingIndex].timestamp = Date.now();
      } else {
        // 新增缓存
        const newEntry: CacheEntry = {
          key: currentKey,
          element: children,
          timestamp: Date.now(),
        };
        cacheListRef.current.push(newEntry);

        // 超出最大缓存数时，删除最久未访问的（LRU）
        while (cacheListRef.current.length > maxCacheCount) {
          // 找到 timestamp 最小的非当前页面
          let minIdx = -1;
          let minTime = Infinity;
          cacheListRef.current.forEach((entry, idx) => {
            if (entry.key !== currentKey && entry.timestamp < minTime) {
              minTime = entry.timestamp;
              minIdx = idx;
            }
          });
          if (minIdx > -1) {
            cacheListRef.current.splice(minIdx, 1);
          } else {
            break;
          }
        }
      }

      // 更新 state 触发渲染
      setCacheList([...cacheListRef.current]);
    } else {
      // 不缓存的页面：直接渲染，不存入 cache
      setCacheList([...cacheListRef.current]);
    }

    // 触发激活回调
    onActivate?.(currentKey);
    prevKeyRef.current = currentKey;
  }, [activeCacheKey, children]);

  // KeepAlive Context 方法
  const dropCache = useCallback((key: string) => {
    cacheListRef.current = cacheListRef.current.filter(
      entry => entry.key !== key,
    );
    setCacheList([...cacheListRef.current]);
  }, []);

  const dropAllCache = useCallback(() => {
    cacheListRef.current = [];
    setCacheList([]);
  }, []);

  const getCacheKeys = useCallback(() => {
    return cacheListRef.current.map(entry => entry.key);
  }, []);

  const refreshCache = useCallback(
    (key: string) => {
      dropCache(key);
      // 如果刷新的是当前页面，下次 effect 会重新缓存
    },
    [dropCache],
  );

  const contextValue = useMemo<KeepAliveContextValue>(
    () => ({ dropCache, dropAllCache, getCacheKeys, refreshCache }),
    [dropCache, dropAllCache, getCacheKeys, refreshCache],
  );

  // 当前页面是否需要缓存
  const isCurrentCached = shouldCache(activeCacheKey);

  return (
    <KeepAliveContext.Provider value={contextValue}>
      {/* 渲染所有已缓存的页面：非活跃的用 display:none 隐藏 */}
      {cacheList.map(entry => (
        <div
          key={entry.key}
          className="keep-alive__page"
          style={{
            display: entry.key === activeCacheKey ? 'block' : 'none',
            height: entry.key === activeCacheKey ? 'auto' : 0,
            overflow: entry.key === activeCacheKey ? 'visible' : 'hidden',
          }}
        >
          {entry.element}
        </div>
      ))}
      {/* 不需要缓存的页面：正常渲染（切走即卸载） */}
      {!isCurrentCached && (
        <div className="keep-alive__page keep-alive__page--no-cache">
          {children}
        </div>
      )}
    </KeepAliveContext.Provider>
  );
};

export default KeepAlive;
