import { useEffect, useRef } from 'react';
import { report } from '../utils/report';

/**
 * 页面停留时长上报 Hook
 * @param eid 事件 ID
 * @param params 额外参数（除 duration 外）
 *
 * @example
 * useStayReport(10001, { pageType: 'home' });
 */
const useStayReport = (eid: number | string, params: Record<string, any> = {}) => {
  const paramsRef = useRef(params);
  const startRef = useRef(Date.now());

  // 同步最新 params
  useEffect(() => {
    paramsRef.current = params;
  }, [params]);

  useEffect(() => {
    let lifecycle: any = {};
    startRef.current = Date.now();

    const doReport = () => {
      const duration = ((Date.now() - startRef.current) / 1000).toFixed(1);
      report(eid, JSON.stringify({ duration, ...(paramsRef.current || {}) }));
    };

    const handleStateChange = (event: any) => {
      if (event.oldState === 'passive' && event.newState === 'hidden') {
        doReport();
      } else if (event.oldState === 'hidden' && event.newState === 'passive') {
        startRef.current = Date.now();
      }
    };

    const importLifecycle = async () => {
      lifecycle = (await import('page-lifecycle')).default;
      lifecycle.addEventListener('statechange', handleStateChange);
    };
    importLifecycle();

    return () => {
      doReport();
      lifecycle?.removeEventListener?.('statechange', handleStateChange);
    };
    // !!!此处严禁添加依赖!!!
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
};

export default useStayReport;
