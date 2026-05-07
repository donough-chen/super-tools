import qs from 'query-string';
import utils from './utils';

/**
 * 获取去重 query 参数（处理数组参数取第一个值）
 */
const getUniqueQuery = (url: string): Record<string, string> => {
  const params = qs.parse(new URL(url).search.slice(1));
  return Object.fromEntries(
    Object.keys(params).map(key => [
      key,
      Array.isArray(params[key]) ? (params[key] as string[])[0] : (params[key] as string),
    ]),
  );
};

/**
 * 数据上报（支持等待上报完成后再跳转，解决 iOS 跳转中止请求问题）
 */
export const report = async (
  eid: number | string,
  szext1 = '',
  szext2 = '',
  szext3 = '',
  szext4 = '',
): Promise<boolean> => {
  const { uin, userId, token, gameId, cCurrentGameId } = getUniqueQuery(window?.location?.href || '');
  const sData = { uin, userId, token, gameId };
  return new Promise(resolve => {
    utils.reportEvent(
      10,
      Number(eid),
      '',
      cCurrentGameId || gameId,
      uin,
      sData,
      szext1,
      szext2,
      szext3,
      szext4,
      () => resolve(true),
    );
  });
};
