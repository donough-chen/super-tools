import { useEffect, useState } from 'react';
import sdk, { TCallbackFunction } from './sdk';

/**
 * React Hook：App 就绪后执行回调
 * @param callback App 就绪回调函数
 */
export const useAppReady = (callback: TCallbackFunction) => {
  const [ready, setReady] = useState(sdk.isReady);

  useEffect(() => {
    if (ready) callback();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  useEffect(() => {
    sdk.ready(() => setReady(true));
  }, []);

  return ready;
};
