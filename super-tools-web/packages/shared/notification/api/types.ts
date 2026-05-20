import type { ApiClientConfig } from './client';
import type { NotificationType } from '../types/domain';

export function createTypesApi(client: ApiClientConfig) {
  return {
    /** 获取支持站内信的通知类型列表 */
    list: () =>
      client.request<NotificationType[]>({
        method: 'GET',
        url: '/api/notification-types',
      }),
  };
}
