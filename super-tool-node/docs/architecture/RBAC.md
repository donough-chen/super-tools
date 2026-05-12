# RBAC 权限体系架构

> 版本：v2.6（2026-05）  
> 适用范围：super-tool-node 管理端 API 的权限控制

---

## 1. 设计目标

将原本依赖 `users.user_type` 单字段判断的粗粒度授权，升级为完整的 **基于角色的访问控制（Role-Based Access Control, RBAC）**：

- **角色 → 权限码 → API 路由** 三段映射，可在不改代码的前提下扩展授权矩阵
- **5 个系统角色** 覆盖典型管理人员分工
- **八大业务模块** 共 **72 条权限码** 划清边界
- **`super_admin` 角色短路** 保证最高权限永远可恢复（通过 RBAC `roles.code='super_admin'` 判定，不再依赖 `user_type` 字段）
- **`user_type` 字段已废弃**（v2.9，2026-05-12），权限判定统一走 `user_roles` + `roles` 表

---

## 2. 核心数据模型

```
users  ─┬─< user_roles >─┬─ roles ─┬─< role_permissions >─┬─ permissions
        │                                                  │
        └─< user_permissions >─────────────────────────────┘   （直接授权/撤销）
```

| 表 | 作用 |
|---|---|
| `roles` | 角色定义。`type=1` 系统角色（不可删），`type=2` 业务自定义角色 |
| `permissions` | 权限定义。`code` 是唯一业务标识；`module` 用于按模块分组与缓存失效；`type ∈ {1=目录,2=菜单,3=按钮,4=API}` |
| `user_roles` | 用户 ↔ 角色 多对多。支持 `expireAt` 时效绑定 |
| `role_permissions` | 角色 ↔ 权限 多对多 |
| `user_permissions` | 用户 ↔ 权限 直接授权。`effect=1` 添加，`effect=0` 撤销（覆盖角色继承） |

---

## 3. 角色矩阵

| 角色 code | 中文名 | 权限数 | 范围概述 |
|---|---|---|---|
| `super_admin` | 超级管理员 | 0（短路） | **全量**，由中间件直接放行；不需要在 `role_permissions` 写入 |
| `admin` | 管理员 | 58 | 所有业务模块全部 + system 只读/permission-test，**不含** 角色分配/直接授权/审计日志 |
| `operator` | 运营 | 37 | dashboard + user 只读 + category/tool/feedback 全部 + stats 不含 export + member 只读 |
| `auditor` | 审计员 | 33 | 全只读 + system 只读 + 审计日志完整（含 export）+ member 只读（含积分流水审计） |
| `user` | 普通用户 | 0 | Web/H5 端默认占位，**不可登录管理端** |
| `guest` | 访客 | 0 | 保留位，无 RBAC 权限 |

> 详细权限映射见 `database/006_add_rbac_init.sql` 与 `database/007_add_member_module.sql` 末尾的校验语句。

### 存量用户自动绑定（历史迁移，user_type 已废弃）

> ⚠️ 以下映射仅用于 006 迁移脚本的历史存量数据迁移，`user_type` 字段已于 v2.9（2026-05-12）废弃。
> 当前权限判定统一通过 `user_roles` + `roles` 表 RBAC 体系管理，不再读取 `user_type`。
> 用户来源平台由 `users.register_source` 字段标识（对应 `oauth_clients.platform`）。

| `users.user_type`（已废弃） | 历史迁移绑定到 |
|---|---|
| `3` | `super_admin` |
| `2` | `admin` |
| `1` | `user` |

---

## 4. 八大业务模块 + 命名规范

| 模块 | 中文名 | 权限数 | 命名前缀 |
|---|---|---|---|
| `dashboard` | 仪表盘 | 2 | `dashboard:*` |
| `system` | 系统管理 | 21 | `system:role:*` / `system:permission:*` / `system:audit-log:*` / `system:permission-test:*` |
| `user` | 用户管理 | 11 | `user:*` |
| `category` | 分类管理 | 6 | `category:*` |
| `tool` | 工具管理 | 10 | `tool:*` |
| `feedback` | 反馈管理 | 5 | `feedback:*` |
| `stats` | 数据统计 | 6 | `stats:*` |
| `member` | 会员管理 | 11 | `member:level:*` / `member:plan:*` / `member:user:*` / `member:points:*` / `member:stats:*` |

**code 命名规则**：

```
<module>[:<sub-module>]:<action>

✅ 推荐
  user:list                   // 简单 CRUD
  user:detail                 // 详情
  user:assign-roles           // 复合动作用 kebab-case
  system:role:list            // 子模块用冒号继续分隔
  system:role:assign-permissions

❌ 避免
  userList                    // 不用 camelCase
  user.list                   // 不用 . 分隔
  list-user                   // 动作不能在前
  user:list:all               // 不要无意义的第三段
```

**标准动作词汇**：`list / detail / create / update / delete / batch-update / export / view / tree / assign-* / copy / run`

---

## 5. 鉴权流程

### 5.1 中间件链

```
┌─────────────┐     ┌──────────────┐     ┌────────────────┐     ┌─────────┐
│ jwt 解析    │ ──> │ ctx.state.user │ ──> │ checkPermission │ ──> │ controller │
└─────────────┘     └──────────────┘     └────────────────┘     └─────────┘
   401 if无效        附用户信息             403 if 无权限          200 业务返回
```

### 5.2 `checkPermission(code | code[])` 决策树

```
开始
  │
  ├─ ctx.state.user 不存在 ────────────────> throw 401
  │
  ├─ service.permission.isSuperAdmin(user.id)
  │     └─ 查 user_roles 表 → roles.code === 'super_admin'
  │     └─ true ────────────────────────────> next() ✅ 直接放行
  │
  ├─ 调用 PermissionService.getUserPermissionCodes(userId)
  │     ├─ 1. 读 redis 缓存 user:permissions:<userId>
  │     ├─ 2. miss → 查 user_roles → role_permissions → permissions.code
  │     ├─ 3. 合并 user_permissions（effect=1 加 / effect=0 减）
  │     └─ 4. 写回 redis（TTL 3600s）
  │
  ├─ requiredCodes.some(c => userCodes.includes(c))
  │     ├─ true  ───> next() ✅
  │     └─ false ───> throw 403 '权限不足'
```

**注意**：当传入数组时是 **OR 语义**（任一命中即放行），不是 AND。  
若需 AND 语义，请在路由处链式挂载多个 `checkPermission` 中间件。

### 5.3 缓存策略

| 缓存 key | TTL | 失效时机 |
|---|---|---|
| `user:permissions:<userId>` | 3600s | 角色分配权限、删除权限、给用户改角色时 `clearCache('user:permissions:*')` |
| `user:roles:<userId>` | 3600s | 同上 |

> 任何**修改 RBAC 数据**的接口都必须在 service 层调 `this.clearCache('user:permissions:*')`，否则会导致权限延迟生效，最长 1 小时。

---

## 6. 路由权限挂载现状

P2-B（七大模块）+ B1（member 模块）完成后，已挂权限的管理端路由分组：

| 路由前缀 | 权限模块 |
|---|---|
| `/api/admin/dashboard` | `dashboard:view` |
| `/api/admin/roles[/...]` | `system:role:*` |
| `/api/admin/permissions[/...]` | `system:permission:*` |
| `/api/admin/tool-categories[/...]` | `category:*` |
| `/api/admin/tools[/...]` | `tool:*` |
| `/api/users[/:id]`（管理端） | `user:*` |
| `/api/admin/member/*` | `member:*`（11 条 API 全部权限化） |

**故意未挂权限的路由**：
- `/api/auth/*` 认证端点
- `/api/users/profile` `/addresses` `/devices` C 端用户操作自己的资源
- `/api/member/*` `/api/tools/*`（非 admin） `/api/favorites/*` C/H5 端公开或自用 API

详见 `app/router.ts` 顶部的注释表。

### member 模块角色矩阵

| 权限码 | admin | operator | auditor |
|---|:---:|:---:|:---:|
| `member`（顶级菜单） | ✓ | ✓ | ✓ |
| `member:level:list` | ✓ | ✓ | ✓ |
| `member:level:update` | ✓ | – | – |
| `member:plan:list` | ✓ | ✓ | ✓ |
| `member:plan:update` | ✓ | – | – |
| `member:user:list` | ✓ | ✓ | ✓ |
| `member:points:adjust` 🔥 | ✓ | – | – |
| `member:level:assign` 🔥 | ✓ | – | – |
| `member:plan:activate` 🔥 | ✓ | – | – |
| `member:stats:view` | ✓ | ✓ | ✓ |
| `member:points:log:view` | ✓ | ✓ | ✓ |

🔥 = 涉及金钱与权益的高敏写操作，仅 admin。operator/auditor 无权调用，调用返回 403。

---

## 7. 前端集成约定

### 7.1 用户上下文入口

```
GET /api/auth/me
→ {
    user: { id, username, nickname, avatar, ... },
    roles: [{ id, code, name, type }],
    permissions: string[],   // 显式权限码列表
    isSuperAdmin: boolean,   // 短路标记，true 时前端按"全量通过"
  }
```

### 7.2 前端控制规范

- **菜单显隐**：根据 `permissions` 中是否包含菜单类 code（`type=2`）决定
- **按钮显隐**：根据 `permissions` 中是否包含按钮类 code（`type=3`）决定
- **`isSuperAdmin === true` 时一律放行**，不需要枚举 code（避免重复 61 条判断）
- 切换账号 / 角色变更后必须重新调 `/api/auth/me`，不要缓存到 localStorage

---

## 8. 测试覆盖

| 测试文件 | 覆盖范围 |
|---|---|
| `test/api/role.test.ts` | 角色 CRUD + 权限分配 |
| `test/api/permission.test.ts` | 权限 CRUD + 树查询 |
| `test/api/rbac.test.ts` | **中间件 401 / 403 / super_admin 短路三大分支** |

**未覆盖（已知风险，列入后续 backlog）**：
- admin/operator/auditor 角色精细矩阵：每个角色每条权限的 200/403 校验
- redis 缓存命中分支：需 mock redis 才能稳定复现
- 用户直接授权（`user_permissions`）的 effect=1/0 覆盖

---

## 9. 相关文档

- 数据库初始化：[`database/006_add_rbac_init.sql`](../../database/006_add_rbac_init.sql)
- member 模块扩展：[`database/007_add_member_module.sql`](../../database/007_add_member_module.sql)
- **user_type 废弃迁移**：[`database/010_deprecate_user_type.sql`](../../database/010_deprecate_user_type.sql)
- user_type 重构设计：[`docs/superpowers/specs/2026-05-12-user-type-refactor-design.md`](../superpowers/specs/2026-05-12-user-type-refactor-design.md)
- 数据库迁移说明：[`database/README.md`](../../database/README.md)
- **加新权限 SOP**：[`guides/添加新权限指南.md`](../guides/添加新权限指南.md)
- 角色管理 API：[`api/role/README.md`](../api/role/README.md)
- 权限管理 API：[`api/permission/README.md`](../api/permission/README.md)
