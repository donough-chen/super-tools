import type { ApiClientConfig } from './client';
import type { NotificationPreferenceItem } from '../types/domain';

export function createPreferencesApi(client: ApiClientConfig) {
  return {
    /** 获取用户所有偏好 */
    list: () =>
      client.request<NotificationPreferenceItem[]>({
        method: 'GET',
        url: '/api/notification-preferences',
      }),

    /** 更新单项偏好 */
    upsert: (input: { typeId: number; channel: string; isSubscribed: boolean }) =>
      client.request<void>({
        method: 'PUT',
        url: '/api/notification-preferences',
        data: input,
      }),
  };
}
