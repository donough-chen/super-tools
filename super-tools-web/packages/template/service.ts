import { request } from '@/utils';

/**
 * 获取示例数据
 * @param params 请求参数
 */
export const getMockData = async (params?: Record<string, any>) => {
  const { code, data } = await request.get('/api/getDemoData', { params });
  return code === 0 ? data : null;
};
