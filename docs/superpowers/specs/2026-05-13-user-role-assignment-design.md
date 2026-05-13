# 用户角色分配功能设计文档

> 版本：1.0  
> 创建时间：2026-05-13  
> 状态：待审核

---

## 1. 概述

为管理端新增「用户角色分配」功能，支持从两个维度管理用户-角色关系：

- **用户列表页**：操作列新增「分配角色」按钮，为单个用户设置角色集合
- **角色管理页**：操作列新增「管理成员」按钮，为单个角色批量管理绑定用户

---

## 2. 现状分析

### 2.1 已有能力

| 层面 | 已有 | 缺失 |
|------|------|------|
| 数据库 | `user_roles` 多对多表（含 expire_at / granted_by） | - |
| 权限码 | `user:assign-roles` + `system:role:assign-users` 已定义 | 路由未注册 |
| 后端服务 | `RoleService.assignUsers()` 增量分配 | 缺少全量替换方法 |
| 前端-用户列表 | CRUD + 状态切换 + 详情 | 无角色分配入口 |
| 前端-角色管理 | CRUD + 权限分配 | 无用户分配入口 |

### 2.2 默认角色机制

所有注册渠道（邮箱/微信/手机号）统一分配 `user` 角色。管理端创建用户不分配角色（需手动）。

---

## 3. 功能设计

### 3.1 用户列表 → 分配角色（Modal）

**入口**：操作列新增「分配角色」按钮（权限码 `user:assign-roles`）

**交互流程**：
1. 点击按钮 → 打开 Modal，标题「分配角色 - {用户名}」
2. Modal 加载时调用 API 获取：全部可用角色列表 + 该用户当前已分配角色
3. 展示角色列表为 Checkbox Group，每个角色显示：
   - 角色名称（Tag 样式）
   - 角色描述（灰色小字）
   - 系统角色标记（不可选/不可移除 super_admin）
4. 管理员勾选/取消勾选角色
5. 点击确定 → 调用 `PUT /api/admin/users/:id/roles` 全量替换
6. 成功后关闭 Modal，刷新列表

**约束规则**：
- `super_admin` 角色不可通过 UI 分配或移除（Checkbox 禁用 + Tooltip 说明）
- 不允许给自己操作（按钮禁用 + Tooltip「不能修改自己的角色」）
- 至少保留一个角色（移除最后一个时提示「至少保留一个角色」）

**UI 示意**：
```
┌─────────────────────────────────────────────┐
│  分配角色 - admin_user                   [×] │
├─────────────────────────────────────────────┤
│                                             │
│  当前用户：admin_user (ID: 1)               │
│                                             │
│  请选择角色：                                │
│                                             │
│  ☑ [管理员]     后台管理权限                  │
│  ☐ [运营]       内容运营权限                  │
│  ☐ [审计员]     只读 + 审计日志查看           │
│  ☑ [普通用户]   Web/H5 端默认角色             │
│  ☐ [访客]       未登录访客权限                │
│                                             │
│  ⚠ 超级管理员角色仅可通过数据库直接操作       │
│                                             │
├─────────────────────────────────────────────┤
│                    [取消]  [确定]             │
└─────────────────────────────────────────────┘
```

### 3.2 角色管理 → 管理成员（Drawer）

**入口**：操作列新增「成员」按钮（权限码 `system:role:assign-users`）

**交互流程**：
1. 点击按钮 → 打开 Drawer，标题「管理成员 - {角色名}({角色编码})」
2. 上半部分：展示当前角色已绑定的用户列表（Table）
   - 列：ID / 用户名 / 昵称 / 邮箱 / 绑定时间 / 操作（移除）
   - 支持搜索过滤
3. 下半部分/底部：「添加成员」按钮 → 打开用户选择器（Select + 远程搜索）
4. 选择用户后确认添加 → 调用 `PUT /api/admin/roles/:id/users`
5. 移除成员 → 调用 `DELETE /api/admin/roles/:id/users/:userId`

**约束规则**：
- super_admin 角色不显示此按钮（与编辑/赋权一致的禁用策略）
- 移除最后一个用户允许（角色可以没有绑定用户）

### 3.3 审计日志

所有角色分配/移除操作记录审计日志：
- module: `user` 或 `role`
- action: `assign_roles` 或 `assign_users` 或 `remove_user_from_role`
- beforeData: 变更前的角色/用户列表
- afterData: 变更后的角色/用户列表

---

## 4. API 设计

### 4.1 为用户分配角色（全量替换）

```
PUT /api/admin/users/:id/roles
权限码: user:assign-roles
```

**Request Body**:
```json
{
  "roleIds": [2, 5]
}
```

**逻辑**：
1. 校验用户存在 + 状态正常
2. 校验 roleIds 中的角色全部存在且状态启用
3. 禁止通过此接口分配/移除 super_admin 角色（roleIds 中若含 super_admin 的 id，忽略或报错）
4. 事务内：
   - 删除该用户所有非 super_admin 的 user_roles 记录
   - 批量插入新的 user_roles 记录（granted_by = 当前操作者 ID）
5. 清除权限缓存 `user:permissions:*`
6. 写审计日志

**Response**:
```json
{
  "code": 200,
  "message": "角色分配成功",
  "data": {
    "userId": 5,
    "roles": [
      { "id": 2, "code": "admin", "name": "管理员" },
      { "id": 5, "code": "user", "name": "普通用户" }
    ]
  }
}
```

### 4.2 获取用户当前角色

复用现有 `GET /api/users/:id`（权限码 `user:detail`），返回中已 include `roles` 关联：

```json
{
  "data": {
    "id": 5,
    "username": "test_user",
    "roles": [
      { "id": 2, "code": "admin", "name": "管理员" },
      { "id": 5, "code": "user", "name": "普通用户" }
    ]
  }
}
```

### 4.3 为角色批量添加用户

```
PUT /api/admin/roles/:id/users
权限码: system:role:assign-users
```

**Request Body**:
```json
{
  "userIds": [3, 5, 8]
}
```

**逻辑**：复用现有 `RoleService.assignUsers()`（增量添加，findOrCreate 防重复）

### 4.4 从角色移除用户

```
DELETE /api/admin/roles/:id/users/:userId
权限码: system:role:assign-users
```

**逻辑**：删除 `user_roles` 中对应记录 + 清缓存 + 审计

### 4.5 获取角色已绑定用户列表

```
GET /api/admin/roles/:id/users
权限码: system:role:assign-users
```

**Query**：`?page=1&pageSize=20&keyword=xxx`

**Response**：分页返回用户列表（id / username / nickname / email / createdAt of binding）

---

## 5. 数据库变更

无 schema 变更。仅需确认以下路由注册 + 权限码已在 `permissions` 表中：

| 权限码 | 当前状态 |
|--------|----------|
| `user:assign-roles` | ✅ 已存在于 006 脚本 |
| `system:role:assign-users` | ✅ 已存在于 006 脚本 |

需要给 admin 角色绑定 `user:assign-roles`（当前 admin 角色不含此权限），或保持仅 super_admin 可操作。

**决策**：`user:assign-roles` 分配给 admin 角色（管理员应能分配角色）。`system:role:assign-users` 同理分配给 admin。

需要新增迁移脚本：`012_add_role_assignment_perms_to_admin.sql`

---

## 6. 前端组件清单

| 组件 | 路径 | 功能 |
|------|------|------|
| `AssignRolesModal.tsx` | `super-tools-admin/src/pages/User/List/` | 用户角色分配 Modal |
| `AssignUsersDrawer.tsx` | `super-tools-admin/src/pages/System/Roles/` | 角色成员管理 Drawer |

**Services 新增**：
- `user.ts`：`assignUserRoles(userId, roleIds)`
- `role.ts`：`getRoleUsers(roleId, query)` / `assignRoleUsers(roleId, userIds)` / `removeRoleUser(roleId, userId)`

---

## 7. 权限同步机制

1. 角色变更后 → 后端 `clearCache('user:permissions:*')` 清除 Redis
2. 下次 API 请求时重新计算权限码并缓存（TTL 3600s）
3. 前端应在分配成功后重新调用 `/api/admin/auth/permissions` 刷新本地权限（如果操作的是当前用户自己，虽然规则上不允许自己改自己）

---

## 8. 安全约束总结

| 约束 | 实现方式 |
|------|----------|
| super_admin 不可通过 UI 分配/移除 | 后端逻辑排除 + 前端 Checkbox 禁用 |
| 不能修改自己的角色 | 前端按钮禁用 + 后端校验 adminId ≠ targetUserId |
| 必须有 `user:assign-roles` 权限 | 路由中间件 `perm('user:assign-roles')` |
| 操作全程审计 | 写 audit_logs，含 before/after 数据 |
| 权限及时生效 | 清 Redis 缓存，下次请求重算 |

---

## 9. 实现优先级

| 优先级 | 内容 |
|--------|------|
| P0 | 后端 API（分配角色 + 路由注册） + 迁移脚本 |
| P0 | 前端 AssignRolesModal（用户列表页） |
| P1 | 前端 AssignUsersDrawer（角色管理页） |
| P2 | 管理端创建用户时选择初始角色 |
