# 用户角色分配功能 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为管理端新增用户角色分配功能，支持从用户列表分配角色（Modal）和从角色管理分配用户（Drawer）

**Architecture:** 后端新增 2 个 API（用户角色全量替换 + 角色用户列表/批量添加/移除），前端新增 AssignRolesModal 和 AssignUsersDrawer 组件。遵循现有 RBAC 体系，权限码已预定义仅需注册路由。

**Tech Stack:** Egg.js (Sequelize ORM) / React + Ant Design + umi / MySQL / Redis

---

## File Structure

### 后端新增/修改

| 文件 | 职责 |
|------|------|
| `super-tool-node/app/service/user.ts` | 新增 `assignRoles()` 方法 |
| `super-tool-node/app/service/role.ts` | 新增 `getRoleUsers()` / `removeUser()` 方法 |
| `super-tool-node/app/controller/admin/role.ts` | 新增 `assignUsers()` / `users()` / `removeUser()` actions |
| `super-tool-node/app/controller/user.ts` | 新增 `assignRoles()` action |
| `super-tool-node/app/router.ts` | 注册 4 条新路由 |
| `super-tool-node/database/012_add_role_assignment_perms_to_admin.sql` | admin 角色绑定 `user:assign-roles` + `system:role:assign-users` |

### 前端新增/修改

| 文件 | 职责 |
|------|------|
| `super-tools-admin/src/services/user.ts` | 新增 `assignUserRoles()` API 封装 |
| `super-tools-admin/src/services/role.ts` | 新增 `getRoleUsers()` / `assignRoleUsers()` / `removeRoleUser()` API 封装 |
| `super-tools-admin/src/pages/User/List/AssignRolesModal.tsx` | 用户角色分配 Modal 组件 |
| `super-tools-admin/src/pages/User/List/index.tsx` | 操作列添加「分配角色」按钮 |
| `super-tools-admin/src/pages/System/Roles/AssignUsersDrawer.tsx` | 角色成员管理 Drawer 组件 |
| `super-tools-admin/src/pages/System/Roles/index.tsx` | 操作列添加「成员」按钮 |

---

### Task 1: 数据库迁移 — 给 admin 角色绑定权限码

**Files:**
- Create: `super-tool-node/database/012_add_role_assignment_perms_to_admin.sql`

- [ ] **Step 1: 创建迁移脚本**

```sql
-- 012_add_role_assignment_perms_to_admin.sql
-- 版本: 2.11.0  | 创建时间: 2026-05-13
-- 说明: 给 admin 角色绑定用户角色分配相关权限码
-- 前置: 006_add_rbac_init.sql（权限码已定义）

USE `superadmin_db`;
SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- 幂等清理
DELETE rp FROM `role_permissions` rp
  INNER JOIN `permissions` p ON rp.permission_id = p.id
  INNER JOIN `roles` r ON rp.role_id = r.id
  WHERE r.code = 'admin'
    AND p.code IN ('user:assign-roles', 'system:role:assign-users');

-- 给 admin 角色绑定
INSERT INTO `role_permissions` (`role_id`, `permission_id`)
SELECT r.id, p.id FROM `roles` r CROSS JOIN `permissions` p
WHERE r.code = 'admin'
  AND p.code IN ('user:assign-roles', 'system:role:assign-users');

SET FOREIGN_KEY_CHECKS = 1;

-- 校验
-- SELECT p.code FROM roles r
--   INNER JOIN role_permissions rp ON rp.role_id = r.id
--   INNER JOIN permissions p ON p.id = rp.permission_id
--   WHERE r.code = 'admin' AND p.code LIKE '%assign%';
-- 期望: user:assign-roles, system:role:assign-users
```

- [ ] **Step 2: 确认权限码存在**

Run: `grep -n "user:assign-roles\|system:role:assign-users" super-tool-node/database/006_add_rbac_init.sql`

Expected: 找到第 232 行 `user:assign-roles` 和第 150 行 `system:role:assign-users`

- [ ] **Step 3: Commit**

```bash
git add super-tool-node/database/012_add_role_assignment_perms_to_admin.sql
git commit -m "db: add role assignment perms to admin role (012)"
```

---

### Task 2: 后端 Service — UserService.assignRoles()

**Files:**
- Modify: `super-tool-node/app/service/user.ts`

- [ ] **Step 1: 在 UserService 中新增 assignRoles 方法**

在 `super-tool-node/app/service/user.ts` 的 `adminChangeStatus` 方法之后（约 337 行），class 结尾之前添加：

```typescript
  /**
   * 为用户分配角色（全量替换，排除 super_admin）
   * - 不允许通过此接口分配/移除 super_admin
   * - 不允许操作自己
   */
  async assignRoles(adminId: number, targetUserId: number, roleIds: number[]) {
    if (adminId === targetUserId) {
      this.ctx.throw(400, '不能修改自己的角色');
    }

    const user = await this.ctx.model.User.findByPk(targetUserId);
    if (!user) this.ctx.throw(404, '用户不存在');

    // 查找 super_admin 角色 ID，排除保护
    const superAdminRole = await this.ctx.model.Role.findOne({ where: { code: 'super_admin' } });
    const superAdminRoleId = superAdminRole ? (superAdminRole as any).id : null;

    // 过滤掉 super_admin（不允许通过 API 分配）
    const safeRoleIds = roleIds.filter(id => id !== superAdminRoleId);

    // 验证所有 roleIds 存在且启用
    if (safeRoleIds.length > 0) {
      const validRoles = await this.ctx.model.Role.findAll({
        where: { id: safeRoleIds, status: 1 },
      });
      if (validRoles.length !== safeRoleIds.length) {
        this.ctx.throw(400, '部分角色不存在或已停用');
      }
    }

    // 事务内全量替换（保留 super_admin 绑定不动）
    await this.ctx.model.transaction(async (t: any) => {
      // 删除非 super_admin 的旧绑定
      const deleteWhere: any = { userId: targetUserId };
      if (superAdminRoleId) {
        const { Op } = require('sequelize');
        deleteWhere.roleId = { [Op.ne]: superAdminRoleId };
      }
      await this.ctx.model.UserRole.destroy({ where: deleteWhere, transaction: t });

      // 批量插入新绑定
      if (safeRoleIds.length > 0) {
        await this.ctx.model.UserRole.bulkCreate(
          safeRoleIds.map(roleId => ({ userId: targetUserId, roleId, grantedBy: adminId })),
          { transaction: t },
        );
      }
    });

    // 清缓存
    await this.clearCache('user:permissions:*');

    // 返回最新角色列表
    const newRoles = await this.service.role.getUserRoles(targetUserId);
    return { userId: targetUserId, roles: newRoles };
  }
```

- [ ] **Step 2: 验证代码无语法错误**

Run: `cd super-tool-node && npx tsc --noEmit --skipLibCheck 2>&1 | head -20`

Expected: 无与 `assignRoles` 相关的错误

- [ ] **Step 3: Commit**

```bash
git add super-tool-node/app/service/user.ts
git commit -m "feat(service): add UserService.assignRoles for role assignment"
```

---

### Task 3: 后端 Service — RoleService.getRoleUsers() + removeUser()

**Files:**
- Modify: `super-tool-node/app/service/role.ts`

- [ ] **Step 1: 在 RoleService 中新增 getRoleUsers 和 removeUser 方法**

在 `super-tool-node/app/service/role.ts` 的 `getUserRoles` 方法之后（约 88 行），class 结尾之前添加：

```typescript
  /**
   * 获取角色已绑定的用户列表（分页）
   */
  async getRoleUsers(roleId: number, query: any): Promise<PaginationResult<any>> {
    const role = await this.ctx.model.Role.findByPk(roleId);
    if (!role) this.ctx.throw(404, '角色不存在');

    const { keyword, ...pagination } = query;
    const { Op } = require('sequelize');

    // 先查 user_roles 获取 userIds
    const userRoleRows = await this.ctx.model.UserRole.findAll({
      where: { roleId },
      attributes: ['userId', 'grantedBy', 'createdAt'],
    });
    const userIds = userRoleRows.map((ur: any) => ur.userId);
    if (userIds.length === 0) {
      return { list: [], total: 0, page: 1, pageSize: 20, totalPages: 0 };
    }

    // 查用户信息
    const where: any = { id: userIds };
    if (keyword) {
      where[Op.and] = [{
        [Op.or]: [
          { username: { [Op.like]: `%${keyword}%` } },
          { nickname: { [Op.like]: `%${keyword}%` } },
          { email: { [Op.like]: `%${keyword}%` } },
          { phone: { [Op.like]: `%${keyword}%` } },
        ],
      }];
    }

    return this.paginate(this.ctx.model.User, {
      where,
      attributes: ['id', 'username', 'nickname', 'email', 'phone', 'avatar', 'status'],
    }, pagination);
  }

  /**
   * 从角色移除单个用户
   */
  async removeUser(roleId: number, userId: number) {
    const role = await this.ctx.model.Role.findByPk(roleId);
    if (!role) this.ctx.throw(404, '角色不存在');
    if ((role as any).code === 'super_admin') {
      this.ctx.throw(400, '不能通过此接口操作超级管理员角色');
    }

    const deleted = await this.ctx.model.UserRole.destroy({
      where: { roleId, userId },
    });
    if (!deleted) this.ctx.throw(404, '该用户未绑定此角色');

    await this.clearCache('user:permissions:*');
  }
```

- [ ] **Step 2: 验证代码无语法错误**

Run: `cd super-tool-node && npx tsc --noEmit --skipLibCheck 2>&1 | head -20`

Expected: 无与 `getRoleUsers` / `removeUser` 相关的错误

- [ ] **Step 3: Commit**

```bash
git add super-tool-node/app/service/role.ts
git commit -m "feat(service): add RoleService.getRoleUsers and removeUser"
```

---

### Task 4: 后端 Controller — 用户角色分配

**Files:**
- Modify: `super-tool-node/app/controller/user.ts`

- [ ] **Step 1: 在 UserController 中新增 assignRoles action**

在 `super-tool-node/app/controller/user.ts` 中，找到管理端用户操作相关方法（如 `resetPassword` 或 `changeStatus`）附近，添加：

```typescript
  /** PUT /api/admin/users/:id/roles — 为用户分配角色 */
  async assignRoles() {
    this.validate({ roleIds: { type: 'array', itemType: 'number' } });
    const targetUserId = Number(this.ctx.params.id);
    const adminId = this.ctx.state.user.id;
    const { roleIds } = this.ctx.request.body;

    // 获取变更前数据
    let beforeRoles: any[] = [];
    try { beforeRoles = await this.service.role.getUserRoles(targetUserId); } catch { /* ignore */ }

    try {
      const result = await this.service.user.assignRoles(adminId, targetUserId, roleIds);
      await this.service.audit.log({
        module: 'user', action: 'assign_roles',
        bizType: 'user', bizId: targetUserId,
        beforeData: { roles: beforeRoles },
        afterData: { roles: result.roles },
        description: `为用户 #${targetUserId} 分配 ${roleIds.length} 个角色`,
        status: 1,
      });
      this.success(result, '角色分配成功');
    } catch (e: any) {
      await this.service.audit.log({
        module: 'user', action: 'assign_roles',
        bizType: 'user', bizId: targetUserId,
        beforeData: { roles: beforeRoles },
        description: `尝试为用户 #${targetUserId} 分配角色`,
        status: 0, failReason: e.message,
      });
      throw e;
    }
  }
```

- [ ] **Step 2: Commit**

```bash
git add super-tool-node/app/controller/user.ts
git commit -m "feat(controller): add assignRoles action to UserController"
```

---

### Task 5: 后端 Controller — 角色用户管理

**Files:**
- Modify: `super-tool-node/app/controller/admin/role.ts`

- [ ] **Step 1: 在 RoleController 中新增 users / assignUsers / removeUser actions**

在 `super-tool-node/app/controller/admin/role.ts` 的 `assignPermissions` 方法之后，class 结尾之前添加：

```typescript
  /** GET /api/admin/roles/:id/users — 获取角色绑定的用户列表 */
  async users() {
    const roleId = Number(this.ctx.params.id);
    const pagination = this.getPagination();
    const { keyword } = this.ctx.query;
    const result = await this.service.role.getRoleUsers(roleId, { ...pagination, keyword });
    this.paginated(result);
  }

  /** PUT /api/admin/roles/:id/users — 为角色批量添加用户 */
  async assignUsers() {
    this.validate({ userIds: { type: 'array', itemType: 'number' } });
    const roleId = Number(this.ctx.params.id);
    const { userIds } = this.ctx.request.body;
    const grantedBy = this.ctx.state.user.id;

    try {
      await this.service.role.assignUsers(roleId, userIds, grantedBy);
      await this.service.audit.log({
        module: 'role', action: 'assign_users',
        bizType: 'role', bizId: roleId,
        afterData: { userIds },
        description: `为角色 #${roleId} 添加 ${userIds.length} 个用户`,
        status: 1,
      });
      this.success(null, '用户添加成功');
    } catch (e: any) {
      await this.service.audit.log({
        module: 'role', action: 'assign_users',
        bizType: 'role', bizId: roleId,
        description: `尝试为角色 #${roleId} 添加用户`,
        status: 0, failReason: e.message,
      });
      throw e;
    }
  }

  /** DELETE /api/admin/roles/:id/users/:userId — 从角色移除用户 */
  async removeUser() {
    const roleId = Number(this.ctx.params.id);
    const userId = Number(this.ctx.params.userId);

    try {
      await this.service.role.removeUser(roleId, userId);
      await this.service.audit.log({
        module: 'role', action: 'remove_user',
        bizType: 'role', bizId: roleId,
        afterData: { removedUserId: userId },
        description: `从角色 #${roleId} 移除用户 #${userId}`,
        status: 1,
      });
      this.success(null, '用户已移除');
    } catch (e: any) {
      await this.service.audit.log({
        module: 'role', action: 'remove_user',
        bizType: 'role', bizId: roleId,
        description: `尝试从角色 #${roleId} 移除用户 #${userId}`,
        status: 0, failReason: e.message,
      });
      throw e;
    }
  }
```

- [ ] **Step 2: Commit**

```bash
git add super-tool-node/app/controller/admin/role.ts
git commit -m "feat(controller): add users/assignUsers/removeUser to RoleController"
```

---

### Task 6: 后端路由注册

**Files:**
- Modify: `super-tool-node/app/router.ts`

- [ ] **Step 1: 在 router.ts 角色管理区域后注册新路由**

在 `super-tool-node/app/router.ts` 第 75 行（`router.put('/api/admin/roles/:id/permissions', ...)`）之后添加：

```typescript
  // ==================== 角色-用户关联 ====================
  router.get('/api/admin/roles/:id/users', auth, perm('system:role:assign-users'), controller.admin.role.users);
  router.put('/api/admin/roles/:id/users', auth, perm('system:role:assign-users'), controller.admin.role.assignUsers);
  router.delete('/api/admin/roles/:id/users/:userId', auth, perm('system:role:assign-users'), controller.admin.role.removeUser);
```

在第 59 行（`router.put('/api/admin/users/:id/status', ...)`）之后添加：

```typescript
  router.put('/api/admin/users/:id/roles',
    auth, perm('user:assign-roles'),
    controller.user.assignRoles);
```

- [ ] **Step 2: 验证代码无语法错误**

Run: `cd super-tool-node && npx tsc --noEmit --skipLibCheck 2>&1 | head -20`

Expected: 无错误

- [ ] **Step 3: Commit**

```bash
git add super-tool-node/app/router.ts
git commit -m "feat(router): register role assignment routes"
```

---

### Task 7: 前端 Service — API 封装

**Files:**
- Modify: `super-tools-admin/src/services/user.ts`
- Modify: `super-tools-admin/src/services/role.ts`

- [ ] **Step 1: 在 user.ts 末尾新增 assignUserRoles**

在 `super-tools-admin/src/services/user.ts` 文件末尾添加：

```typescript
/** PUT /api/admin/users/:id/roles — 为用户分配角色（全量替换） */
export async function assignUserRoles(id: number, roleIds: number[]) {
  return request(`/api/admin/users/${id}/roles`, {
    method: 'PUT',
    data: { roleIds },
  });
}
```

- [ ] **Step 2: 在 role.ts 末尾新增角色用户管理 API**

在 `super-tools-admin/src/services/role.ts` 文件末尾添加：

```typescript
/** GET /api/admin/roles/:id/users — 获取角色绑定的用户列表 */
export async function getRoleUsers(id: number, params?: { page?: number; pageSize?: number; keyword?: string }) {
  return request(`/api/admin/roles/${id}/users`, { params });
}

/** PUT /api/admin/roles/:id/users — 为角色批量添加用户 */
export async function assignRoleUsers(id: number, userIds: number[]) {
  return request(`/api/admin/roles/${id}/users`, {
    method: 'PUT',
    data: { userIds },
  });
}

/** DELETE /api/admin/roles/:id/users/:userId — 从角色移除用户 */
export async function removeRoleUser(roleId: number, userId: number) {
  return request(`/api/admin/roles/${roleId}/users/${userId}`, {
    method: 'DELETE',
  });
}
```

- [ ] **Step 3: Commit**

```bash
git add super-tools-admin/src/services/user.ts super-tools-admin/src/services/role.ts
git commit -m "feat(services): add role assignment API wrappers"
```

---

### Task 8: 前端组件 — AssignRolesModal

**Files:**
- Create: `super-tools-admin/src/pages/User/List/AssignRolesModal.tsx`

- [ ] **Step 1: 创建 AssignRolesModal 组件**

```tsx
import React, { useEffect, useState } from 'react';
import { Modal, Checkbox, Space, Tag, Spin, Tooltip, message, Typography } from 'antd';
import { listRoles, Role } from '@/services/role';
import { getUser, assignUserRoles, User } from '@/services/user';

const { Text } = Typography;

interface Props {
  visible: boolean;
  target: User | null;
  onClose: () => void;
  onSuccess: () => void;
}

const AssignRolesModal: React.FC<Props> = ({ visible, target, onClose, onSuccess }) => {
  const [roles, setRoles] = useState<Role[]>([]);
  const [checkedIds, setCheckedIds] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible && target) {
      setLoading(true);
      Promise.all([
        listRoles({ pageSize: 100 }),
        getUser(target.id),
      ]).then(([rolesRes, userRes]: any[]) => {
        const allRoles: Role[] = rolesRes?.data?.list || [];
        // 排除 super_admin（不可通过 UI 操作）
        setRoles(allRoles.filter(r => r.code !== 'super_admin'));
        const currentRoleIds = (userRes?.data?.roles || [])
          .map((r: any) => r.id)
          .filter((id: number) => !Number.isNaN(id));
        // 排除 super_admin 角色 ID
        const saRole = allRoles.find(r => r.code === 'super_admin');
        setCheckedIds(currentRoleIds.filter((id: number) => id !== saRole?.id));
      }).catch((e: any) => {
        message.error(e?.message || '加载角色数据失败');
      }).finally(() => {
        setLoading(false);
      });
    } else {
      setRoles([]);
      setCheckedIds([]);
    }
  }, [visible, target]);

  const handleOk = async () => {
    if (!target) return;
    if (checkedIds.length === 0) {
      message.warning('至少保留一个角色');
      return;
    }
    setSaving(true);
    try {
      const res: any = await assignUserRoles(target.id, checkedIds);
      if (res?.code === 200) {
        message.success('角色分配成功');
        onSuccess();
        onClose();
      } else {
        message.error(res?.message || '分配失败');
      }
    } catch (e: any) {
      message.error(e?.message || '分配失败');
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (roleId: number, checked: boolean) => {
    if (checked) {
      setCheckedIds(prev => [...prev, roleId]);
    } else {
      const next = checkedIds.filter(id => id !== roleId);
      if (next.length === 0) {
        message.warning('至少保留一个角色');
        return;
      }
      setCheckedIds(next);
    }
  };

  return (
    <Modal
      title={`分配角色 - ${target?.nickname || target?.username || ''}`}
      open={visible}
      onCancel={onClose}
      onOk={handleOk}
      confirmLoading={saving}
      destroyOnClose
      width={520}
    >
      <Spin spinning={loading}>
        <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
          当前用户：{target?.username} (ID: {target?.id})
        </Text>
        <Space direction="vertical" style={{ width: '100%' }}>
          {roles.map(role => (
            <div key={role.id} style={{ padding: '8px 0', borderBottom: '1px solid #f0f0f0' }}>
              <Checkbox
                checked={checkedIds.includes(role.id)}
                onChange={(e) => handleChange(role.id, e.target.checked)}
              >
                <Tag color="blue">{role.name}</Tag>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  {role.description || role.code}
                </Text>
              </Checkbox>
            </div>
          ))}
        </Space>
        <Tooltip title="超级管理员角色仅可通过数据库直接操作">
          <Text type="warning" style={{ display: 'block', marginTop: 16, fontSize: 12 }}>
            ⚠ 超级管理员角色不在此列表中显示
          </Text>
        </Tooltip>
      </Spin>
    </Modal>
  );
};

export default AssignRolesModal;
```

- [ ] **Step 2: Commit**

```bash
git add super-tools-admin/src/pages/User/List/AssignRolesModal.tsx
git commit -m "feat(admin): add AssignRolesModal component"
```

---

### Task 9: 前端集成 — 用户列表页添加「分配角色」按钮

**Files:**
- Modify: `super-tools-admin/src/pages/User/List/index.tsx`

- [ ] **Step 1: 导入 AssignRolesModal 并添加状态**

在 `index.tsx` 顶部 import 区域添加：

```typescript
import AssignRolesModal from './AssignRolesModal';
```

在组件内状态声明区域（约第 35 行 `detailVisible` 之后）添加：

```typescript
  const [rolesTarget, setRolesTarget] = useState<User | null>(null);
  const [rolesVisible, setRolesVisible] = useState(false);
```

- [ ] **Step 2: 在操作列 columns 中添加「分配角色」按钮**

在 `columns` 定义的操作列 render 中，`<AuthButton permCode="user:update">` 之后添加：

```tsx
          <AuthButton permCode="user:assign-roles">
            {isSelf(row.id, currentUserId) ? (
              <Tooltip title="不能修改自己的角色">
                <a className="action-disabled">角色</a>
              </Tooltip>
            ) : (
              <a onClick={() => { setRolesTarget(row); setRolesVisible(true); }}>角色</a>
            )}
          </AuthButton>
```

- [ ] **Step 3: 在 JSX return 末尾渲染 AssignRolesModal**

在 `<DetailDrawer ... />` 之后添加：

```tsx
      <AssignRolesModal
        visible={rolesVisible}
        target={rolesTarget}
        onClose={() => setRolesVisible(false)}
        onSuccess={fetch}
      />
```

- [ ] **Step 4: Commit**

```bash
git add super-tools-admin/src/pages/User/List/index.tsx
git commit -m "feat(admin): integrate AssignRolesModal in user list page"
```

---

### Task 10: 前端组件 — AssignUsersDrawer

**Files:**
- Create: `super-tools-admin/src/pages/System/Roles/AssignUsersDrawer.tsx`

- [ ] **Step 1: 创建 AssignUsersDrawer 组件**

```tsx
import React, { useEffect, useState } from 'react';
import {
  Drawer, Table, Button, Space, Input, Popconfirm, message, Select, Avatar,
} from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import type { Role } from '@/services/role';
import { getRoleUsers, assignRoleUsers, removeRoleUser } from '@/services/role';
import { listUsers } from '@/services/user';

interface Props {
  visible: boolean;
  role: Role | null;
  onClose: () => void;
  onSuccess: () => void;
}

const AssignUsersDrawer: React.FC<Props> = ({ visible, role, onClose, onSuccess }) => {
  const [data, setData] = useState<{ list: any[]; total: number }>({ list: [], total: 0 });
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [keyword, setKeyword] = useState('');

  // 添加用户相关
  const [addVisible, setAddVisible] = useState(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [selectedUserIds, setSelectedUserIds] = useState<number[]>([]);
  const [adding, setAdding] = useState(false);

  const fetchUsers = async () => {
    if (!role) return;
    setLoading(true);
    try {
      const res: any = await getRoleUsers(role.id, { page, pageSize: 10, keyword: keyword || undefined });
      if (res?.code === 200 && res.data) {
        setData({ list: res.data.list || [], total: res.data.total || 0 });
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (visible && role) {
      setPage(1);
      setKeyword('');
      fetchUsers();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, role]);

  useEffect(() => {
    if (visible && role) fetchUsers();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, keyword]);

  const handleRemove = async (userId: number) => {
    if (!role) return;
    const res: any = await removeRoleUser(role.id, userId);
    if (res?.code === 200) {
      message.success('已移除');
      fetchUsers();
      onSuccess();
    } else {
      message.error(res?.message || '移除失败');
    }
  };

  const handleSearch = async (value: string) => {
    if (!value || value.length < 2) { setSearchResults([]); return; }
    const res: any = await listUsers({ keyword: value, pageSize: 20 });
    if (res?.code === 200) {
      setSearchResults(res.data?.list || []);
    }
  };

  const handleAdd = async () => {
    if (!role || selectedUserIds.length === 0) return;
    setAdding(true);
    try {
      const res: any = await assignRoleUsers(role.id, selectedUserIds);
      if (res?.code === 200) {
        message.success(`已添加 ${selectedUserIds.length} 个用户`);
        setSelectedUserIds([]);
        setAddVisible(false);
        fetchUsers();
        onSuccess();
      } else {
        message.error(res?.message || '添加失败');
      }
    } finally {
      setAdding(false);
    }
  };

  const columns = [
    { title: 'ID', dataIndex: 'id', width: 70 },
    {
      title: '用户', dataIndex: 'username', width: 160,
      render: (v: string, row: any) => (
        <Space>
          <Avatar src={row.avatar} size="small">{v?.[0]?.toUpperCase()}</Avatar>
          {row.nickname || v}
        </Space>
      ),
    },
    { title: '邮箱', dataIndex: 'email', width: 180, render: (v: string) => v || '-' },
    { title: '手机', dataIndex: 'phone', width: 130, render: (v: string) => v || '-' },
    {
      title: '操作', width: 80,
      render: (_: any, row: any) => (
        <Popconfirm title="确定移除？" onConfirm={() => handleRemove(row.id)}>
          <a style={{ color: '#ff4d4f' }}>移除</a>
        </Popconfirm>
      ),
    },
  ];

  return (
    <Drawer
      title={role ? `管理成员 - ${role.name} (${role.code})` : '管理成员'}
      open={visible}
      onClose={onClose}
      width={700}
      destroyOnClose
    >
      <Space style={{ marginBottom: 16, width: '100%', justifyContent: 'space-between' }}>
        <Input.Search
          placeholder="搜索用户名/昵称/邮箱"
          allowClear
          style={{ width: 240 }}
          onSearch={(v) => { setPage(1); setKeyword(v); }}
        />
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setAddVisible(true)}>
          添加成员
        </Button>
      </Space>

      <Table
        rowKey="id"
        columns={columns}
        dataSource={data.list}
        loading={loading}
        pagination={{
          current: page, pageSize: 10, total: data.total,
          onChange: (p) => setPage(p),
          showTotal: (t) => `共 ${t} 人`,
        }}
        size="small"
      />

      {/* 添加成员弹窗 */}
      {addVisible && (
        <div style={{ marginTop: 24, padding: 16, background: '#fafafa', borderRadius: 8 }}>
          <Space direction="vertical" style={{ width: '100%' }}>
            <Select
              mode="multiple"
              placeholder="搜索并选择用户（至少输入2字）"
              style={{ width: '100%' }}
              showSearch
              filterOption={false}
              onSearch={handleSearch}
              value={selectedUserIds}
              onChange={setSelectedUserIds}
              options={searchResults.map((u: any) => ({
                label: `${u.nickname || u.username} (${u.email || u.phone || u.username})`,
                value: u.id,
              }))}
            />
            <Space>
              <Button type="primary" loading={adding} onClick={handleAdd}
                disabled={selectedUserIds.length === 0}>
                确认添加 ({selectedUserIds.length})
              </Button>
              <Button onClick={() => { setAddVisible(false); setSelectedUserIds([]); }}>
                取消
              </Button>
            </Space>
          </Space>
        </div>
      )}
    </Drawer>
  );
};

export default AssignUsersDrawer;
```

- [ ] **Step 2: Commit**

```bash
git add super-tools-admin/src/pages/System/Roles/AssignUsersDrawer.tsx
git commit -m "feat(admin): add AssignUsersDrawer component"
```

---

### Task 11: 前端集成 — 角色管理页添加「成员」按钮

**Files:**
- Modify: `super-tools-admin/src/pages/System/Roles/index.tsx`

- [ ] **Step 1: 导入 AssignUsersDrawer 并添加状态**

在 `index.tsx` 顶部 import 区域，在 `import AssignPermDrawer` 之后添加：

```typescript
import AssignUsersDrawer from './AssignUsersDrawer';
```

在组件内状态声明区域（约第 22 行 `drawerVisible` 之后）添加：

```typescript
  const [usersDrawerVisible, setUsersDrawerVisible] = useState(false);
  const [usersDrawerRole, setUsersDrawerRole] = useState<Role | null>(null);
```

- [ ] **Step 2: 在操作列中添加「成员」按钮**

在 `columns` 定义的操作列 render 中，赋权按钮（`AuthButton permCode="role:assign-permissions"`）之后、删除按钮之前添加：

```tsx
          {isSuperAdmin(row) ? (
            <Tooltip title="超级管理员成员不可管理">
              <a className="super-admin-disabled">成员</a>
            </Tooltip>
          ) : (
            <AuthButton permCode="system:role:assign-users">
              <a onClick={() => { setUsersDrawerRole(row); setUsersDrawerVisible(true); }}>成员</a>
            </AuthButton>
          )}
```

- [ ] **Step 3: 在 JSX return 末尾渲染 AssignUsersDrawer**

在 `<AssignPermDrawer ... />` 之后添加：

```tsx
      <AssignUsersDrawer
        visible={usersDrawerVisible}
        role={usersDrawerRole}
        onClose={() => setUsersDrawerVisible(false)}
        onSuccess={fetch}
      />
```

- [ ] **Step 4: Commit**

```bash
git add super-tools-admin/src/pages/System/Roles/index.tsx
git commit -m "feat(admin): integrate AssignUsersDrawer in roles page"
```

---

### Task 12: 最终验证

- [ ] **Step 1: 后端编译检查**

Run: `cd super-tool-node && npx tsc --noEmit --skipLibCheck`

Expected: 无错误

- [ ] **Step 2: 前端编译检查**

Run: `cd super-tools-admin && npx tsc --noEmit --skipLibCheck`

Expected: 无错误（或仅已有的无关 warning）

- [ ] **Step 3: 最终合并提交**

```bash
cd d:\Donough\Projects\super-tools
git add -A
git status
```

确认所有文件正确后无需额外提交（各 Task 已单独 commit）。

---

## 验收测试清单

| # | 场景 | 预期结果 |
|---|------|----------|
| 1 | super_admin 登录 → 用户列表 → 点击「角色」→ 打开 Modal | 显示角色列表（不含 super_admin），当前已分配角色已勾选 |
| 2 | 勾选/取消角色 → 确定 | 调用 PUT /api/admin/users/:id/roles → 成功提示 |
| 3 | 尝试取消所有角色 | 前端提示「至少保留一个角色」 |
| 4 | 对自己点击「角色」按钮 | 按钮禁用，Tooltip「不能修改自己的角色」 |
| 5 | 角色管理 → 点击「成员」→ 打开 Drawer | 显示当前角色已绑定用户列表 |
| 6 | 点击「添加成员」→ 搜索用户 → 选择 → 确认 | 调用 PUT /api/admin/roles/:id/users → 列表刷新 |
| 7 | 点击「移除」 | 确认后调用 DELETE → 用户从列表消失 |
| 8 | 普通用户（无权限）看不到「角色」「成员」按钮 | AuthButton 隐藏 |
| 9 | 审计日志中可查到角色分配操作 | module=user/role，action=assign_roles/assign_users |
