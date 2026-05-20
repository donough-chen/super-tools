# P1-11：Shared SDK（@super-tools/notification-sdk）

> 父计划：[2026-05-16-notification-phase-1-00-overview.md](./2026-05-16-notification-phase-1-00-overview.md)
> 包含 Task：**T17**
> 前置：T12（Socket 事件已固化）、T15（C 端 API 已固化）

---

## Task 17：共享 SDK 全套实现

**目标**：在 `super-tools-web` monorepo 下新增 `packages/shared/notification-sdk` 子包，被 admin/h5/pc 三端共用。

### 17.1 子包初始化：`packages/shared/notification-sdk/package.json`

```json
{
  "name": "@super-tools/notification-sdk",
  "version": "0.1.0",
  "private": true,
  "main": "src/index.ts",
  "types": "src/index.ts",
  "scripts": {
    "test": "jest"
  },
  "dependencies": {
    "socket.io-client": "^4.7.0"
  },
  "peerDependencies": {
    "react": ">=16",
    "react-dom": ">=16"
  },
  "devDependencies": {
    "@types/jest": "^29.0.0",
    "jest": "^29.0.0",
    "msw": "^2.0.0",
    "ts-jest": "^29.0.0",
    "typescript": "^5.0.0"
  }
}
```

更新 `super-tools-web/pnpm-workspace.yaml`（或 lerna/yarn 等）确保子包被识别。

### 17.2 类型定义：`src/types/domain.ts`

```typescript
export type NotificationChannel = 'inApp' | 'email' | 'sms';
export type NotificationPriority = 'low' | 'normal' | 'high';
export type NotificationStatus = 'pending' | 'sent' | 'delivered' | 'failed';

export interface NotificationMessage {
  id: number;
  taskId: number | null;
  userId: number;
  typeId: number;
  channel: NotificationChannel;
  templateId: number | null;
  templateVersion: number | null;
  title: string;
  body: string;
  priority: NotificationPriority;
  status: NotificationStatus;
  isRead: 0 | 1;
  readAt: string | null;
  archivedAt: string | null;
  bizRefType: string | null;
  bizRefId: string | null;
  createdAt: string;
}

export interface NotificationPreferenceItem {
  typeId: number;
  typeKey: string;
  typeName: string;
  channels: NotificationChannel[];
  enabled: 0 | 1;
}
```

### 17.3 事件类型：`src/types/events.ts`

```typescript
export interface NotificationNewPayload {
  id: number;
  typeId: number;
  title: string;
  body: string;
  priority: 'low' | 'normal' | 'high';
  createdAt: string;
}

export interface NotificationUnreadCountPayload {
  count: number;
}

export interface SocketEventMap {
  'notification:new': NotificationNewPayload;
  'notification:unread_count': NotificationUnreadCountPayload;
  'heartbeat:ack': { ts: number };
}
```

### 17.4 API 客户端：`src/api/client.ts`

```typescript
export interface ApiClientConfig {
  baseURL: string;
  /** 自定义 fetch（admin 用 umi-request；h5/pc 用 axios），SDK 内部不约束 */
  request: <T = any>(opts: {
    method: 'GET' | 'POST' | 'PUT' | 'DELETE';
    url: string;
    params?: any;
    data?: any;
    headers?: Record<string, string>;
  }) => Promise<T>;
}

export function createApiClient(cfg: ApiClientConfig) {
  return cfg;
}
```

`src/api/messages.ts`：

```typescript
import type { ApiClientConfig } from './client';
import type { NotificationMessage } from '../types/domain';

export interface ListParams {
  isRead?: 0 | 1;
  typeId?: number;
  archived?: 0 | 1;
  page?: number;
  pageSize?: number;
}

export function createMessagesApi(client: ApiClientConfig) {
  return {
    list: (params: ListParams = {}) =>
      client.request<{ list: NotificationMessage[]; total: number }>({
        method: 'GET', url: '/api/notifications', params,
      }),
    unreadCount: () =>
      client.request<{ count: number }>({
        method: 'GET', url: '/api/notifications/unread-count',
      }),
    detail: (id: number) =>
      client.request<NotificationMessage>({
        method: 'GET', url: `/api/notifications/${id}`,
      }),
    markRead: (ids: number[]) =>
      client.request<void>({
        method: 'POST', url: '/api/notifications/mark-read', data: { ids },
      }),
    markAllRead: () =>
      client.request<void>({
        method: 'POST', url: '/api/notifications/mark-all-read',
      }),
    archive: (id: number) =>
      client.request<void>({
        method: 'POST', url: `/api/notifications/${id}/archive`,
      }),
  };
}
```

`src/api/preferences.ts`：

```typescript
import type { ApiClientConfig } from './client';
import type { NotificationPreferenceItem, NotificationChannel } from '../types/domain';

export function createPreferencesApi(client: ApiClientConfig) {
  return {
    list: () => client.request<NotificationPreferenceItem[]>({
      method: 'GET', url: '/api/notification-preferences',
    }),
    upsert: (input: { typeId: number; channels: NotificationChannel[]; enabled: 0 | 1 }) =>
      client.request<void>({
        method: 'PUT', url: '/api/notification-preferences', data: input,
      }),
  };
}
```

`src/api/index.ts`：

```typescript
export * from './client';
export * from './messages';
export * from './preferences';
```

### 17.5 Socket 客户端：`src/socket/client.ts`

```typescript
import { io, Socket } from 'socket.io-client';
import type { SocketEventMap } from '../types/events';

export interface SocketClientConfig {
  url: string;
  getToken: () => string | null | Promise<string | null>;
  /** 重连配置 */
  reconnectionAttempts?: number;
  reconnectionDelay?: number;
}

export interface NotificationSocket {
  socket: Socket | null;
  connect: () => Promise<void>;
  disconnect: () => void;
  on: <K extends keyof SocketEventMap>(event: K, handler: (payload: SocketEventMap[K]) => void) => void;
  off: <K extends keyof SocketEventMap>(event: K, handler?: (payload: SocketEventMap[K]) => void) => void;
}

export function createSocketClient(cfg: SocketClientConfig): NotificationSocket {
  let socket: Socket | null = null;
  return {
    get socket() { return socket; },

    async connect() {
      if (socket?.connected) return;
      const token = await cfg.getToken();
      if (!token) {
        // eslint-disable-next-line no-console
        console.warn('[notif-sdk] no token, skip connect');
        return;
      }
      socket = io(cfg.url, {
        transports: ['websocket'],
        auth: { token },
        reconnectionAttempts: cfg.reconnectionAttempts ?? 5,
        reconnectionDelay: cfg.reconnectionDelay ?? 1000,
      });
      socket.on('connect_error', (err) => {
        // eslint-disable-next-line no-console
        console.warn('[notif-sdk] connect_error', err.message);
      });
    },
    disconnect() {
      socket?.disconnect();
      socket = null;
    },
    on(event, handler) { socket?.on(event as string, handler as any); },
    off(event, handler) {
      if (handler) socket?.off(event as string, handler as any);
      else socket?.off(event as string);
    },
  };
}
```

`src/socket/index.ts`：

```typescript
export * from './client';
```

### 17.6 React Hooks

`src/hooks/useUnreadCount.ts`：

```typescript
import { useEffect, useState } from 'react';
import type { NotificationSocket } from '../socket/client';

export function useUnreadCount(opts: {
  socket: NotificationSocket;
  fetchInitial: () => Promise<{ count: number }>;
}) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    let mounted = true;
    opts.fetchInitial().then((r) => { if (mounted) setCount(r.count); });
    const handler = (p: { count: number }) => setCount(p.count);
    opts.socket.on('notification:unread_count', handler);
    return () => {
      mounted = false;
      opts.socket.off('notification:unread_count', handler);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return count;
}
```

`src/hooks/useNotificationSocket.ts`：

```typescript
import { useEffect } from 'react';
import type { NotificationSocket } from '../socket/client';

export function useNotificationSocket(socket: NotificationSocket, enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    socket.connect();
    return () => socket.disconnect();
  }, [enabled, socket]);
}
```

`src/hooks/useNotificationList.ts`：

```typescript
import { useCallback, useEffect, useState } from 'react';
import type { NotificationMessage } from '../types/domain';
import type { NotificationSocket } from '../socket/client';

export interface UseNotificationListOpts {
  socket: NotificationSocket;
  fetchPage: (params: { page: number; pageSize: number }) => Promise<{ list: NotificationMessage[]; total: number }>;
  pageSize?: number;
}

export function useNotificationList(opts: UseNotificationListOpts) {
  const [list, setList] = useState<NotificationMessage[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const pageSize = opts.pageSize ?? 20;

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const r = await opts.fetchPage({ page, pageSize });
      setList(r.list);
      setTotal(r.total);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, opts]);

  useEffect(() => { reload(); }, [reload]);

  useEffect(() => {
    const onNew = (msg: any) => {
      // 仅当处于第一页时插入新消息
      if (page === 1) {
        setList((prev) => [{ ...msg } as any, ...prev].slice(0, pageSize));
        setTotal((t) => t + 1);
      }
    };
    opts.socket.on('notification:new', onNew);
    return () => opts.socket.off('notification:new', onNew);
  }, [page, pageSize, opts.socket]);

  return { list, total, page, setPage, pageSize, loading, reload };
}
```

`src/hooks/usePreferences.ts`：

```typescript
import { useCallback, useEffect, useState } from 'react';
import type { NotificationPreferenceItem, NotificationChannel } from '../types/domain';

export function usePreferences(opts: {
  fetchAll: () => Promise<NotificationPreferenceItem[]>;
  saveOne: (input: { typeId: number; channels: NotificationChannel[]; enabled: 0 | 1 }) => Promise<void>;
}) {
  const [list, setList] = useState<NotificationPreferenceItem[]>([]);
  const [saving, setSaving] = useState(false);

  const reload = useCallback(async () => {
    setList(await opts.fetchAll());
  }, [opts]);

  useEffect(() => { reload(); }, [reload]);

  const update = useCallback(async (input: { typeId: number; channels: NotificationChannel[]; enabled: 0 | 1 }) => {
    setSaving(true);
    try {
      await opts.saveOne(input);
      setList((prev) => prev.map((p) => p.typeId === input.typeId
        ? { ...p, channels: input.channels, enabled: input.enabled } : p));
    } finally {
      setSaving(false);
    }
  }, [opts]);

  return { list, saving, update, reload };
}
```

`src/hooks/index.ts`：

```typescript
export * from './useUnreadCount';
export * from './useNotificationSocket';
export * from './useNotificationList';
export * from './usePreferences';
```

### 17.7 创建 SDK 工厂：`src/utils/createSdk.ts`

```typescript
import { createApiClient, type ApiClientConfig } from '../api/client';
import { createMessagesApi } from '../api/messages';
import { createPreferencesApi } from '../api/preferences';
import { createSocketClient, type SocketClientConfig } from '../socket/client';

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
```

### 17.8 统一导出：`src/index.ts`

```typescript
export * from './types/domain';
export * from './types/events';
export * from './api';
export * from './socket';
export * from './hooks';
export * from './utils/createSdk';
```

### 17.9 测试：`src/__tests__/api.test.ts`（msw mock）

```typescript
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';
import { createNotificationSdk } from '../utils/createSdk';

const server = setupServer(
  http.get('http://test/api/notifications/unread-count', () => HttpResponse.json({ count: 7 })),
);
beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

test('messages.unreadCount', async () => {
  const sdk = createNotificationSdk({
    api: {
      baseURL: 'http://test',
      request: async ({ url }) => {
        const res = await fetch(`http://test${url}`);
        return res.json();
      },
    },
    socket: { url: 'http://test', getToken: () => null },
  });
  const r: any = await sdk.messages.unreadCount();
  expect(r.count).toBe(7);
});
```

`src/__tests__/socket.test.ts`：

```typescript
// socket 单测：仅断言 createSocketClient 返回的 API 形状（不实际连接）
import { createSocketClient } from '../socket/client';

test('createSocketClient 返回稳定 API', () => {
  const c = createSocketClient({ url: 'http://x', getToken: () => null });
  expect(typeof c.connect).toBe('function');
  expect(typeof c.disconnect).toBe('function');
  expect(typeof c.on).toBe('function');
  expect(typeof c.off).toBe('function');
});
```

### 17.10 README：`README.md`

```markdown
# @super-tools/notification-sdk

通知系统三端共享 SDK：REST API + Socket.IO + React Hooks。

## 使用

\`\`\`ts
import { createNotificationSdk, useUnreadCount } from '@super-tools/notification-sdk';
import { request } from 'umi'; // 或 axios

const sdk = createNotificationSdk({
  api: {
    baseURL: '',
    request: ({ method, url, params, data }) =>
      request(url, { method, params, data }),
  },
  socket: {
    url: process.env.SOCKET_URL || '',
    getToken: () => localStorage.getItem('token'),
  },
});

// 在 React 组件
function Bell() {
  const count = useUnreadCount({
    socket: sdk.socket,
    fetchInitial: () => sdk.messages.unreadCount(),
  });
  return <span>{count}</span>;
}
\`\`\`
```

### 17.11 验证 & Commit

- [ ] `pnpm --filter @super-tools/notification-sdk test` 全绿
- [ ] admin/h5/pc 任意端 `import { createNotificationSdk } from '@super-tools/notification-sdk'` 解析正常
- [ ] commit: `feat(sdk): add @super-tools/notification-sdk (api/socket/hooks)`

---

## 完成检查

- [ ] 子包目录与文件结构与 overview 一致（types/api/socket/hooks/utils/__tests__）
- [ ] 4 个 hooks 全部就绪
- [ ] msw 单测通过
- [ ] 三端在 T18~T21 中可顺利接入
