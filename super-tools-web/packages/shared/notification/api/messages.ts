import type { ApiClientConfig } from './client';
import type { NotificationMessage, PaginatedResult } from '../types/domain';

export interface ListMessagesParams {
  isRead?: 0 | 1;
  typeId?: number;
  archived?: 0 | 1;
  page?: number;
  pageSize?: number;
}

export function createMessagesApi(client: ApiClientConfig) {
  return {
    /** 消息列表 */
    list: (params: ListMessagesParams = {}) =>
      client.request<PaginatedResult<NotificationMessage>>({
        method: 'GET',
        url: '/api/notifications',
        params,
      }),

    /** 未读数 */
    unreadCount: () =>
      client.request<{ count: number }>({
        method: 'GET',
        url: '/api/notifications/unread-count',
      }),

    /** 消息详情 */
    detail: (id: number) =>
      client.request<NotificationMessage>({
        method: 'GET',
        url: `/api/notifications/${id}`,
      }),

    /** 批量标记已读 */
    markRead: (ids: number[]) =>
      client.request<{ affected: number }>({
        method: 'POST',
        url: '/api/notifications/mark-read',
        data: { ids },
      }),

    /** 全部标记已读 */
    markAllRead: () =>
      client.request<{ affected: number }>({
        method: 'POST',
        url: '/api/notifications/mark-all-read',
      }),

    /** 归档 */
    archive: (id: number) =>
      client.request<void>({
        method: 'POST',
        url: `/api/notifications/${id}/archive`,
      }),
  };
}
