import { createApiClient, type ApiClientConfig } from './api/client';
import { createMessagesApi } from './api/messages';
import { createPreferencesApi } from './api/preferences';
import { createSocketClient, type SocketClientConfig } from './socket/client';

/**
 * 创建通知 SDK 实例
 *
 * @example
 * ```ts
 * import { createNotificationSdk } from '@/notification';
 *
 * const sdk = createNotificationSdk({
 *   api: { request: ({ method, url, params, data }) => request(url, { method, params, data }) },
 *   socket: { url: '/notification', getToken: () => localStorage.getItem('token') },
 * });
 * ```
 */
export function createNotificationSdk(opts: {
  api: ApiClientConfig;
  socket: SocketClientConfig;
}) {
  const apiClient = createApiClient(opts.api);
  return {
    messages: createMessagesApi(apiClient),
    preferences: createPreferencesApi(apiClient),
    socket: createSocketClient(opts.socket),
  };
}

export type NotificationSdk = ReturnType<typeof createNotificationSdk>;
