/** Socket 推送：新消息 */
export interface NotificationNewPayload {
  id: number;
  typeId: number;
  title: string;
  content: string;
  priority: number;
  createdAt: string;
}

/** Socket 推送：未读数变更 */
export interface NotificationUnreadCountPayload {
  count: number;
}

/** Socket 事件映射表 */
export interface SocketEventMap {
  'notification:new': NotificationNewPayload;
  'notification:unread_count': NotificationUnreadCountPayload;
  'heartbeat:ack': { ts: number };
}
