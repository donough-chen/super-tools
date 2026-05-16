/** 渠道 */
export type NotificationChannel = 'in_app' | 'email' | 'sms';

/** 优先级 (0=P0紧急 1=P1高 2=P2普通 3=P3低) */
export type NotificationPriority = 0 | 1 | 2 | 3;

/** 消息记录 */
export interface NotificationMessage {
  id: number;
  taskId: number | null;
  userId: number;
  typeId: number;
  templateId: number | null;
  templateVersion: number | null;
  title: string;
  content: string;
  summary: string | null;
  extra: Record<string, any> | null;
  channels: string[];
  priority: NotificationPriority;
  isRead: 0 | 1;
  readAt: string | null;
  isArchived: 0 | 1;
  archivedAt: string | null;
  expireAt: string | null;
  createdAt: string;
  /** 关联的类型信息（join 时才有） */
  type?: {
    id: number;
    code: string;
    name: string;
    icon?: string;
    color?: string;
  };
}

/** 偏好条目 */
export interface NotificationPreferenceItem {
  typeId: number;
  typeCode: string;
  typeName: string;
  channel: string;
  isSubscribed: boolean;
}

/** 分页响应 */
export interface PaginatedResult<T> {
  list: T[];
  total: number;
  page: number;
  pageSize: number;
}
