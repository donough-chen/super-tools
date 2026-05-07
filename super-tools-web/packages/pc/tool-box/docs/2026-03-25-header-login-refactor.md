# Header 登录模块重构 + 公告弹窗 Bug 修复

**对话日期：** 2026-03-25  
**涉及模块：** Header 组件、GlobalModal 组件、useAnnouncement Hook

---

## 需求背景

1. **Header 登录模块重构**：将 Header 中原有的 Ant Design `Modal` 登录弹窗删除，改为接入已开发的登录页面（`/login`）和用户状态管理（`useUserStore`）
2. **公告弹窗 Bug 修复**：
   - 点击"我知道了"按钮后弹窗不关闭
   - 登录用户刷新页面后公告重复弹出

---

## 技术方案

### Header 登录模块改造

**改造前：**
- PC 端：点击"登录"按钮弹出 Ant Design `Modal`，内含简单的 `Form` 表单（无真实登录逻辑）
- 移动端：跳转 `/login` 页面

**改造后：**
- 统一跳转 `/login` 页面（PC/移动端一致）
- 已登录：显示用户昵称，点击弹出 Ant Design `Dropdown` 下拉菜单，提供"退出登录"选项
- 退出登录：调用 `useUserStore.logout()`，清除 token，Toast 提示，跳转首页

---

## 实现详情

### 修改文件：`components/Header/index.tsx`

**删除的内容：**
- `Modal`、`Form`、`Button`、`message` 的 antd import
- `loginVisible` 状态变量
- `form` 实例（`Form.useForm()`）
- `handleLoginSubmit` 登录提交函数
- 整个 PC 端登录 `<Modal>` JSX 块

**新增的内容：**

```tsx
// 引入
import { Dropdown } from 'antd';
import type { MenuProps } from 'antd';
import { LogoutOutlined } from '@ant-design/icons';
import { useUserStore } from '@/store/user';

// 状态
const { userInfo, logout } = useUserStore();

// 退出登录
const handleLogout = () => {
  logout();
  showToast({ content: '已退出登录', duration: 2000 });
  navigateTo('/');
};

// 已登录用户下拉菜单
const userMenuItems: MenuProps['items'] = [
  {
    key: 'profile',
    icon: <UserOutlined />,
    label: userInfo?.nickname || userInfo?.username || '个人中心',
    disabled: true,  // 仅展示，不可点击
  },
  { type: 'divider' },
  {
    key: 'logout',
    icon: <LogoutOutlined />,
    label: '退出登录',
    onClick: handleLogout,
  },
];
```

**JSX 改造（右上角登录区域）：**
```tsx
{userInfo ? (
  <Dropdown menu={{ items: userMenuItems }} placement="bottomRight" trigger={['click']}>
    <button className="header__login-btn header__login-btn--logged">
      <UserOutlined />
      <span className="header__login-text">
        {userInfo.nickname || userInfo.username}
      </span>
    </button>
  </Dropdown>
) : (
  <button
    className="header__login-btn"
    onClick={() => navigateTo('/login')}
  >
    <UserOutlined />
    <span className="header__login-text">登录</span>
  </button>
)}
```

---

## 问题与修复

### Bug 1：点击"我知道了"后弹窗不关闭

**文件：** `components/GlobalModal/index.tsx`

**根因：** 按钮点击逻辑判断条件写反：
```tsx
// ❌ 修复前：有 onClick 时反而不关闭
onClick={async () => {
  await btn.onClick?.();
  if (!btn.onClick) handleClose();  // 有 onClick 时这行不执行！
}}
```

**修复：**
```tsx
// ✅ 修复后：执行 onClick 后始终关闭
onClick={async () => {
  await btn.onClick?.();
  handleClose();  // 无条件关闭
}}
```

### Bug 2：登录用户刷新后公告重复弹出

**文件：** `utils/useAnnouncement.ts`

**根因：** Mock 服务的 `activeSessions` 是内存变量，每次 dev server 重启后 session 丢失，导致服务端认为用户未登录，`/api/announcements/unread` 返回所有公告（全部 `isRead: false`）。

**修复方案：** 为登录用户增加 localStorage 本地缓存兜底：

```ts
// 新增常量
const USER_READ_KEY_PREFIX = 'super_tools_user_read_announcements_';

// 新增函数
const getUserReadIds = (userId: string): string[] => { ... };
const addUserReadId = (userId: string, announcementId: string) => { ... };

// 修改过滤逻辑（双重过滤）
const userReadIds = getUserReadIds(userInfo.id);
unread = res.data.filter((a) => !a.isRead && !userReadIds.includes(a.id));

// 修改标记已读（先写本地缓存，再调 API）
addUserReadId(userInfo.id, first.id);
await markAnnouncementRead(first.id).catch(() => {});
```

**缓存 key 设计：**
- Key：`super_tools_user_read_announcements_{userId}`（以 userId 区分不同账号）
- 有效期：永久（后续接入真实后端后可移除此兜底逻辑）

---

## 文件变更记录

| 文件路径 | 变更类型 | 说明 |
|----------|----------|------|
| `components/Header/index.tsx` | 修改 | 删除旧登录弹窗，接入 useUserStore |
| `components/GlobalModal/index.tsx` | 修改 | 修复按钮点击不关闭弹窗的 Bug |
| `utils/useAnnouncement.ts` | 修改 | 新增登录用户本地缓存兜底，修复重复弹出 Bug |

---

## 注意事项

- `header__login-btn--logged` 样式类需在 `Header/index.less` 中补充（已登录状态的视觉区分）
- Mock session 重置问题是开发环境特有问题，生产环境接入真实后端后自然解决
- `useUserStore` 使用 Zustand persist，`userInfo` 会持久化到 `localStorage.super_tools_user`，页面刷新后自动恢复

---

## 后续计划

- [ ] 已登录状态下 Header 显示用户头像（当前仅显示昵称）
- [ ] 支持在 Header 直接修改部分设置（如主题切换）
- [ ] 登录过期后自动跳转登录页并保存当前路由（登录后回跳）
