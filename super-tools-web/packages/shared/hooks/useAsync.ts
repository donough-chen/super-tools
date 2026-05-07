import { useState, useEffect, useCallback } from 'react';

/**
 * 异步数据加载 Hook
 * @param fetcher 异步数据获取函数
 * @param deps 依赖数组
 *
 * @example
 * const { data, loading, error, refetch } = useAsync(() => fetchUserInfo(userId), [userId]);
 */
const useAsync = <T>(
  fetcher: () => Promise<T>,
  deps: any[] = [],
) => {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetcher();
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { data, loading, error, refetch: fetch };
};

export default useAsync;
