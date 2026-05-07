# 网站更新公告模块 + 用户认证系统开发

**对话日期：** 2026-03-24  
**涉及模块：** 用户认证、公告系统、设置页面、登录页面、BasicLayout

---

## 需求背景

为 Super Tools 网站设计完整的更新公告模块，包含：
1. **用户认证系统**：注册/登录页面，7 天持久化登录态
2. **通知设置**：登录用户从服务端获取，游客从 localStorage 读取（7 天有效）
3. **更新公告**：登录用户每条公告只弹一次，游客基于本地缓存判断；使用 GlobalModal 居中展示，支持 Markdown 渲染

---

## 技术方案

### 整体架构

```
BasicLayout (初始化入口)
  ├── initUser()          → 恢复 localStorage 中的登录态
  └── checkAnnouncements() → 800ms 后检查并展示未读公告
        ↓
  useAnnouncement (Hook)
    ├── 登录用户：服务端 isRead + 本地缓存双重过滤
    └── 游客：localStorage 已读 ID 列表过滤
        ↓
  GlobalModal (居中弹窗，Markdown 内容渲染)
```

### 数据持久化策略

| 数据类型 | 存储位置 | 有效期 |
|----------|----------|--------|
| 登录 Token | `localStorage.token` | 7 天 |
| 用户信息 | Zustand persist（`super_tools_user`） | 永久（随 token 失效） |
| 游客设置 | `localStorage.super_tools_guest_settings` | 7 天 |
| 游客已读公告 | `localStorage.super_tools_guest_read_announcements` | 7 天 |
| 登录用户已读公告（兜底） | `localStorage.super_tools_user_read_announcements_{userId}` | 永久 |

### Mock 服务设计

Mock 数据存储在 `mock/index.ts` 的内存变量中（模拟数据库）：
- `mockUsers`：用户数据，含密码哈希、已读公告列表、个人设置
- `mockAnnouncements`：公告数据，含 Markdown 格式内容
- `activeSessions`：Token → UserId 映射（内存，重启后失效）

---

## 实现详情

### 新增文件

#### `store/user.ts`
用户状态管理，基于 Zustand + immer + persist：
- `UserInfo`：用户信息类型（id、username、nickname、email、avatar、role、settings）
- `UserSettings`：设置类型（notificationEnabled、theme、language）
- `setUserInfo`：登录成功后设置用户信息，同步服务端设置
- `logout`：清除 token 和用户信息，恢复游客设置
- `updateSettings`：更新设置，游客自动写入 localStorage，登录用户由调用方同步 API
- `init`：检查 token 有效性，恢复登录态

#### `utils/useAnnouncement.ts`
公告检查与展示 Hook：
- 仅在 `settings.notificationEnabled === true` 时执行
- 登录用户：服务端 `isRead` + 本地缓存双重过滤（防 session 重置后重复弹出）
- 游客：localStorage 已读 ID 列表过滤（7 天有效期）
- 展示第一条未读公告，点击"我知道了"后标记已读

#### `components/AnnouncementContent/`
简易 Markdown 渲染组件（无第三方依赖）：
- 支持：`#`/`##`/`###` 标题、`**加粗**`、`` `行内代码` ``、`- 列表`、`---` 水平线、普通段落
- 使用 `dangerouslySetInnerHTML` 渲染行内样式（内容来自可信 mock 数据）

#### `pages/Login/`
登录/注册页面（Tab 切换）：
- 登录：支持用户名或邮箱登录
- 注册：用户名（字母/数字/下划线，3-20位）、昵称（可选）、邮箱、密码（≥6位）、确认密码
- 成功后保存 token 到 localStorage，写入 Zustand store，跳转首页
- 测试账号：`admin / admin123`

#### `pages/Login/index.less`
登录页样式，卡片居中布局，圆角按钮，适配深色模式。

### 修改文件

#### `mock/index.ts`
新增接口：
- `POST /api/auth/register`：注册，校验用户名/邮箱唯一性，密码哈希存储
- `POST /api/auth/login`：登录，支持用户名或邮箱，返回 token + userInfo
- `GET /api/user/profile`：获取用户信息（需 Bearer token）
- `PUT /api/user/settings`：更新用户设置（需 Bearer token）
- `GET /api/announcements/list`：公告列表（登录用户附带已读状态）
- `GET /api/announcements/unread`：未读公告（登录用户服务端过滤，游客返回全部）
- `POST /api/announcements/mark-read`：标记已读（需 Bearer token）

#### `services/api.ts`
新增接口函数：`register`、`authLogin`、`getUserProfile`、`updateUserSettings`、`getAnnouncementList`、`getUnreadAnnouncements`、`markAnnouncementRead`

统一请求函数自动携带 `Authorization: Bearer {token}` 请求头。

#### `pages/Settings/index.tsx`
- 新增账号卡片：已登录显示用户信息 + 退出登录按钮，未登录显示"去登录"按钮
- 通知开关接入 `useUserStore.settings.notificationEnabled`，切换时同步 API（登录用户）或 localStorage（游客）

#### `layouts/BasicLayout/index.tsx`
- 引入 `useUserStore`、`useAnnouncement`
- `useEffect` 初始化用户状态（`initUser()`）
- `initialized` 变为 `true` 后，延迟 800ms 触发 `checkAnnouncements()`

#### `.umirc.ts`
注册 `/login` 路由，独立于 `BasicLayout` 之外（无 Header/Sidebar）。

---

## 问题与修复

### 问题 1：点击"我知道了"后弹窗不关闭

**根因：** `GlobalModal/index.tsx` 按钮点击逻辑：
```tsx
// ❌ 有 onClick 时反而不关闭
if (!btn.onClick) handleClose();
```

**修复：** 改为无条件关闭：
```tsx
await btn.onClick?.();
handleClose();  // 始终关闭
```

### 问题 2：登录用户刷新页面后公告重复弹出

**根因：** Mock 服务的 `activeSessions` 是内存变量，每次 dev server 重启后 session 丢失，导致服务端认为用户未登录，返回所有公告为未读。

**修复方案：** 在 `useAnnouncement.ts` 中为登录用户增加 **localStorage 本地缓存兜底**：
- 点击"我知道了"时，先写入 `super_tools_user_read_announcements_{userId}`，再调用服务端接口
- 下次检查时，服务端 `isRead` + 本地缓存双重过滤，任一为已读则不弹出

```ts
// 登录用户：双重过滤
const userReadIds = getUserReadIds(userInfo.id);
unread = res.data.filter((a) => !a.isRead && !userReadIds.includes(a.id));

// 标记已读时同时写入本地缓存
addUserReadId(userInfo.id, first.id);
await markAnnouncementRead(first.id).catch(() => {});
```

---

## 文件变更记录

| 文件路径 | 变更类型 |
|----------|----------|
| `store/user.ts` | 新增 |
| `utils/useAnnouncement.ts` | 新增 |
| `components/AnnouncementContent/index.tsx` | 新增 |
| `components/AnnouncementContent/index.less` | 新增 |
| `pages/Login/index.tsx` | 新增 |
| `pages/Login/index.less` | 新增 |
| `mock/index.ts` | 修改（新增认证和公告接口） |
| `services/api.ts` | 修改（新增接口函数） |
| `pages/Settings/index.tsx` | 修改（账号卡片 + 通知开关） |
| `pages/Settings/index.less` | 修改（新增账号相关样式） |
| `layouts/BasicLayout/index.tsx` | 修改（用户初始化 + 公告检查） |
| `.umirc.ts` | 修改（注册 /login 路由） |

---

## 核心流程图

```
用户访问页面
    ↓
BasicLayout.initUser()
    ├── 有有效 token → 恢复 userInfo（Zustand persist）
    └── 无 token / 已过期 → 游客模式，读取 localStorage 设置
    ↓
initialized = true → 延迟 800ms
    ↓
checkAnnouncements()
    ├── notificationEnabled = false → 跳过
    └── notificationEnabled = true
          ↓
        GET /api/announcements/unread
          ├── 登录用户：服务端 isRead + 本地缓存 双重过滤
          └── 游客：localStorage 已读 ID 列表过滤
          ↓
        有未读公告 → GlobalModal 居中弹窗
          ↓
        用户点击"我知道了"
          ├── 登录用户：写本地缓存 + POST /api/announcements/mark-read
          └── 游客：写 localStorage 已读 ID
```

---

## 后续计划

- [ ] 接入真实后端接口（替换 mock）
- [ ] 支持展示多条公告（翻页或队列）
- [ ] 公告支持富文本编辑器格式（替换简易 Markdown 渲染）
- [ ] 用户头像上传功能
- [ ] 登录页支持"记住我"选项
