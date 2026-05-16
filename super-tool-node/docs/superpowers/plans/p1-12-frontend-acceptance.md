# P1-12：前端三端实现 + 端到端验收

> 父计划：[2026-05-16-notification-phase-1-00-overview.md](./2026-05-16-notification-phase-1-00-overview.md)
> 包含 Task：**T18 / T19 / T20 / T21 / T22**
> 前置：T17（SDK）；T13/T14/T15（后端 API）

---

## Task 18：Admin —— 路由 + permCodes + Notification 模块页面

### 18.1 路由：`config/routes/modules/notification.ts`

```typescript
export default {
  path: '/notification',
  name: 'notification',
  icon: 'BellOutlined',
  access: 'canAccessNotification',
  routes: [
    { path: '/notification/types', name: 'types', component: '@/pages/Notification/Types', access: 'canViewNotificationType' },
    { path: '/notification/templates', name: 'templates', component: '@/pages/Notification/Templates', access: 'canViewNotificationTemplate' },
    { path: '/notification/tasks', name: 'tasks', component: '@/pages/Notification/Tasks', access: 'canViewNotificationTask' },
    { path: '/notification/messages', name: 'messages', component: '@/pages/Notification/Messages', access: 'canViewNotificationMessage' },
    { path: '/notification/my', name: 'my', component: '@/pages/Notification/MyNotifications' },
  ],
};
```

`config/routes/index.ts` 中 `import notification from './modules/notification'` 并加入 routes 数组。

### 18.2 permCodes：`src/pages/Notification/_shared/permCodes.ts`

```typescript
export const NOTIF_PERM = {
  TYPE_VIEW: 'notification:type:view',
  TYPE_EDIT: 'notification:type:edit',
  TEMPLATE_VIEW: 'notification:template:view',
  TEMPLATE_EDIT: 'notification:template:edit',
  TEMPLATE_PUBLISH: 'notification:template:publish',
  TEMPLATE_TEST_SEND: 'notification:template:test_send',
  TASK_VIEW: 'notification:task:view',
  TASK_CREATE: 'notification:task:create',
  MESSAGE_VIEW: 'notification:message:view',
} as const;
```

`src/access.ts` 中追加：

```typescript
export default function (initialState: any) {
  const perms: string[] = initialState?.currentUser?.permissions || [];
  const has = (k: string) => perms.includes(k);
  return {
    // ...existing accesses
    canAccessNotification: has('notification:type:view') || has('notification:template:view') || has('notification:task:view'),
    canViewNotificationType: has('notification:type:view'),
    canEditNotificationType: has('notification:type:edit'),
    canViewNotificationTemplate: has('notification:template:view'),
    canEditNotificationTemplate: has('notification:template:edit'),
    canPublishNotificationTemplate: has('notification:template:publish'),
    canTestSendNotificationTemplate: has('notification:template:test_send'),
    canViewNotificationTask: has('notification:task:view'),
    canCreateNotificationTask: has('notification:task:create'),
    canViewNotificationMessage: has('notification:message:view'),
  };
}
```

### 18.3 services：`src/services/notification.ts`

```typescript
import { request } from 'umi';

export const NotificationApi = {
  // types
  listTypes: (params: any) => request('/api/admin/notification/types', { params }),
  createType: (data: any) => request('/api/admin/notification/types', { method: 'POST', data }),
  updateType: (id: number, data: any) => request(`/api/admin/notification/types/${id}`, { method: 'PUT', data }),
  deleteType: (id: number) => request(`/api/admin/notification/types/${id}`, { method: 'DELETE' }),
  // templates
  listTemplates: (params: any) => request('/api/admin/notification/templates', { params }),
  detailTemplate: (id: number) => request(`/api/admin/notification/templates/${id}`),
  createTemplate: (data: any) => request('/api/admin/notification/templates', { method: 'POST', data }),
  updateTemplate: (id: number, data: any) => request(`/api/admin/notification/templates/${id}`, { method: 'PUT', data }),
  publishTemplate: (id: number) => request(`/api/admin/notification/templates/${id}/publish`, { method: 'POST' }),
  previewTemplate: (id: number, params: any) => request(`/api/admin/notification/templates/${id}/preview`, { method: 'POST', data: { params } }),
  testSendTemplate: (id: number, data: any) => request(`/api/admin/notification/templates/${id}/test-send`, { method: 'POST', data }),
  // tasks
  listTasks: (params: any) => request('/api/admin/notification/tasks', { params }),
  detailTask: (id: number) => request(`/api/admin/notification/tasks/${id}`),
  createTask: (data: any) => request('/api/admin/notification/tasks', { method: 'POST', data }),
  // messages（管理员）
  listMessages: (params: any) => request('/api/admin/notification/messages', { params }),
  detailMessage: (id: number) => request(`/api/admin/notification/messages/${id}`),
  // my notifications（复用 C 端 API）
  listMy: (params: any) => request('/api/notifications', { params }),
  unreadCount: () => request('/api/notifications/unread-count'),
  markRead: (ids: number[]) => request('/api/notifications/mark-read', { method: 'POST', data: { ids } }),
  preferences: () => request('/api/notification-preferences'),
  upsertPreference: (data: any) => request('/api/notification-preferences', { method: 'PUT', data }),
};
```

### 18.4 页面骨架（每个文件 100-200 行 ProTable / Modal / Drawer 形式）

- `pages/Notification/Types/index.tsx`：ProTable 列表 + 启停 Switch + 编辑 Modal（typeKey/name/category/defaultChannels/priority/enabled）；删除按钮当 templateCount>0 时禁用
- `pages/Notification/Types/TypeFormModal.tsx`：表单
- `pages/Notification/Types/TypeDetailDrawer.tsx`：展示 + 关联模板列表
- `pages/Notification/Templates/index.tsx`：ProTable 列表，列：typeKey/lang/channel/version/isActive/updatedAt
- `pages/Notification/Templates/TemplateFormDrawer.tsx`：左编辑右预览（onChange 防抖 300ms 调用 preview API）
- `pages/Notification/Templates/TemplatePreviewModal.tsx`：纯展示历史快照
- `pages/Notification/Templates/TemplateTestSendModal.tsx`：选择 userId/输入 params → 调用 testSendTemplate
- `pages/Notification/Tasks/index.tsx`：ProTable + "立即发送"按钮触发 CreateTaskWizard
- `pages/Notification/Tasks/CreateTaskWizard.tsx`：4 步向导
  - Step1 选 type
  - Step2 选受众（仅 all/static；static 通过 SearchSelect 多选用户）
  - Step3 输入参数（动态渲染：根据模板提取 `{{var}}` 列出 input）
  - Step4 预览 + 确认
- `pages/Notification/Tasks/TaskDetailDrawer.tsx`：展示 task + status + 按 status 分组的消息计数
- `pages/Notification/Messages/index.tsx`：ProTable + filter（userId/typeId/channel/status/taskId）
- `pages/Notification/Messages/MessageDetailDrawer.tsx`：展示 message 详情 + send_logs
- `pages/Notification/MyNotifications/index.tsx`：使用 SDK hook `useNotificationList`

> 各页面均使用 `<Access accessible={access.canEditXxx}>` 控制写入按钮可见性。

### 18.5 Commit

```
feat(admin): notification module pages (types/templates/tasks/messages/my)
```

---

## Task 19：Admin —— 顶部铃铛 + 多端登录验证

### 19.1 组件：`src/components/NotificationBell/index.tsx`

```tsx
import React, { useEffect, useMemo } from 'react';
import { Badge, Dropdown } from 'antd';
import { BellOutlined } from '@ant-design/icons';
import { useUnreadCount, useNotificationSocket, createNotificationSdk } from '@super-tools/notification-sdk';
import { request } from 'umi';
import NotificationPanel from './NotificationPanel';

const sdk = createNotificationSdk({
  api: {
    baseURL: '',
    request: ({ method, url, params, data }) =>
      request(url, { method, params, data }) as any,
  },
  socket: {
    url: window.location.origin,
    getToken: () => localStorage.getItem('admin_token'),
  },
});

export default function NotificationBell() {
  useNotificationSocket(sdk.socket, true);
  const count = useUnreadCount({
    socket: sdk.socket,
    fetchInitial: () => sdk.messages.unreadCount(),
  });

  const items = useMemo(() => [{
    key: 'panel',
    label: <NotificationPanel sdk={sdk} />,
  }], []);

  return (
    <Dropdown menu={{ items }} trigger={['click']} placement="bottomRight">
      <Badge count={count} offset={[-4, 4]}>
        <BellOutlined style={{ fontSize: 18, cursor: 'pointer' }} />
      </Badge>
    </Dropdown>
  );
}
```

`NotificationPanel.tsx`：使用 `sdk.messages.list({ pageSize: 10 })` 拉最新 10 条；点击行调用 `markRead([id])` 后跳转 `/notification/my`。

将 `<NotificationBell />` 挂到 `RightContent` 或 `HeaderContent` 中。

### 19.2 多端登录验证

- 双 Tab 同账号登录 admin（开两个浏览器窗口）
- 在 Tab A 通过 admin 后台触发立即发送
- Tab B 应在 1s 内收到铃铛红点 +1 与列表插入

> 此步骤不写自动化 UI 测试，由 Task 22 的端到端验收清单覆盖。

### 19.3 Commit

```
feat(admin): notification bell + my notifications page wired with SDK
```

---

## Task 20：H5 —— AppHeader 改造 + 消息中心 + 偏好

### 20.1 路由：`packages/h5/micro-tools/routes.config.ts` 追加

```typescript
{ path: '/notifications', component: 'notifications/index' },
{ path: '/notifications/detail/:id', component: 'notifications/detail/[id]' },
{ path: '/settings/notification', component: 'settings/notification/index' },
```

### 20.2 AppHeader 扩展

`packages/h5/micro-tools/components/AppHeader/types.ts`：

```typescript
export type HeaderButtonType = 'back' | 'home' | 'share' | 'message' | /* existing */ ...;
```

`components/AppHeader/index.tsx` 中 button 渲染分支增加：

```tsx
case 'message': {
  return (
    <Badge count={unreadCount} offset={[-2, 2]}>
      <Icon name="message" onClick={() => history.push('/notifications')} />
    </Badge>
  );
}
```

`unreadCount` 来自 zustand store。

### 20.3 store：`packages/h5/micro-tools/store/notification.ts`

```typescript
import { create } from 'zustand';
import { createNotificationSdk } from '@super-tools/notification-sdk';
import request from '@/utils/request'; // 项目现有

const sdk = createNotificationSdk({
  api: {
    baseURL: '',
    request: ({ method, url, params, data }) => request(url, { method, params, data }),
  },
  socket: {
    url: process.env.SOCKET_URL || window.location.origin,
    getToken: () => localStorage.getItem('user_token'),
  },
});

interface State {
  unreadCount: number;
  init: () => void;
  refresh: () => Promise<void>;
}

export const useNotificationStore = create<State>((set) => ({
  unreadCount: 0,
  init: () => {
    sdk.socket.connect();
    sdk.socket.on('notification:unread_count', (p: any) => set({ unreadCount: p.count }));
    sdk.messages.unreadCount().then((r: any) => set({ unreadCount: r.count }));
  },
  refresh: async () => {
    const r: any = await sdk.messages.unreadCount();
    set({ unreadCount: r.count });
  },
}));

export const notificationSdk = sdk;
```

`layouts/index.tsx` 在登录后调用 `useNotificationStore.getState().init()`。

### 20.4 页面

`pages/notifications/index.tsx`：使用 `notificationSdk.messages.list` 分页；上拉加载更多；点击行 `markRead` 后跳详情。
`pages/notifications/detail/[id].tsx`：展示完整 body（HTML）+ 操作按钮（归档）。
`pages/settings/notification/index.tsx`：使用 `usePreferences` hook 渲染列表，每行：type 名称 + 渠道多选 + 启停 Switch。

### 20.5 Commit

```
feat(h5): notification center + message header button + preference settings
```

---

## Task 21：PC —— Header 铃铛 + 通知中心

### 21.1 路由：`packages/pc/tool-box/.umirc.ts` 追加

```typescript
{ path: '/notifications', component: '@/pages/notifications' },
{ path: '/notifications/preferences', component: '@/pages/notifications/preferences' },
```

### 21.2 NotificationDropdown 组件

`components/NotificationDropdown/index.tsx` 与 admin 端 NotificationBell 类似，区别仅在 Header 视觉与 sdk 配置（PC 用户 token）。

### 21.3 store + 页面

参照 H5 实现 zustand store；列表页用 AntD Web 版（PC 端使用 antd 5）；偏好页同上。

### 21.4 Commit

```
feat(pc): notification dropdown + center page + preference page
```

---

## Task 22：端到端联调 + P1 验收门禁清单

> 这是 P1 的"出厂检查"。逐项过完才允许标记 P1 完成。

### 22.1 后端验收

- [ ] `npm test` 全部测试通过；新增覆盖率 ≥ 70%
- [ ] `npm run lint` 0 错误
- [ ] DB 迁移 018 在干净库可正常 up & rollback
- [ ] BullMQ 队列在 dev 启动出现 `[notif] queue lifecycle started`
- [ ] Socket.IO 鉴权：无 token 立即断开；有效 token 加入房间（用 socket.io-client 实测）
- [ ] 错误码段无重复（脚本扫描 `app/constants/errorCodes.ts`）
- [ ] 审计日志：types/templates/tasks 的所有写操作均有 `audit_logs` 行

### 22.2 SDK 验收

- [ ] `pnpm --filter @super-tools/notification-sdk test` 全绿
- [ ] admin/h5/pc 三端均能 `import` 通过类型检查
- [ ] socket 在 token 失效时不死循环重连（最多 5 次）

### 22.3 业务端到端验收（手工 + 自动化混合）

| # | 场景 | 步骤 | 预期 |
|---|------|------|------|
| 1 | 反馈回复 → 三端实时 | 用户提交反馈 → admin 回复 | h5/pc 1s 内出现红点+1，铃铛/列表可见 |
| 2 | 异地登录告警 | 切换 IP 登录 | sendDirect 写库且推送（用户即使关闭偏好也收到） |
| 3 | 验证码审计 | 用户请求验证码 | 短信仍发；同时 inApp 通知写一条审计 |
| 4 | 立即发送任务 | admin 创建 static 受众任务（10 用户） | task 状态 running → completed；10 条消息状态 delivered |
| 5 | 偏好关闭 | 用户关闭 feedback_reply 通知 → admin 触发 | notification.send 返回 skipped=true；用户无消息 |
| 6 | 模板版本 | 创建草稿 v2 → 发布 → 触发 | 新消息使用 v2；旧消息 templateVersion 仍 v1 |
| 7 | 多端登录一致 | 同账号开 h5 + pc + admin 三端 | 任一端发触发，其余两端同时收到推送 |
| 8 | 已读同步 | h5 标记已读 | pc/admin 的未读计数同步刷新 |
| 9 | 归档 | h5 归档某条 | pc 列表默认（未归档）也消失，归档列表可见 |
| 10 | Socket 重连 | 主动断网 5s 后恢复 | 客户端自动重连，未读计数与列表自动刷新 |

### 22.4 性能 & 韧性

- [ ] 100 用户 static 任务：从创建到全部 delivered ≤ 5s
- [ ] worker 异常时 BullMQ 自动重试 3 次（jobOptions.attempts）；最终失败写 `notification_send_logs` failed
- [ ] message_id 幂等：同 jobId 第二次入队不重复写库

### 22.5 文档与交接

- [ ] 在 `super-tool-node/docs/superpowers/plans/2026-05-16-notification-phase-1-self-review.md` 写自检结果（spec coverage / placeholder scan / type consistency / 依赖闭环）
- [ ] 在项目 `CHANGELOG.md` 增加 P1 条目，注明 11 张表与 21 类型已上线
- [ ] 通知 PM/QA 提供"立即发送"使用手册（截图 admin Tasks 页面流程）

### 22.6 Commit & 标记

```
chore(notification): mark phase 1 acceptance done

- end-to-end verification passed (10 scenarios)
- self-review document attached
```

最终在 git 上为 P1 完成打 tag：`p1-notification-done`。

---

## 完成检查（整个 Phase 1）

- [ ] T1-T22 全部 Commit 落库
- [ ] 22.1-22.5 全部勾选
- [ ] self-review 文档已写
- [ ] 无 P1 范围内的已知 P0/P1 缺陷

> P1 完成后，立刻规划 P2（频控/静默/Email-真实/任务定时/Cron）。
