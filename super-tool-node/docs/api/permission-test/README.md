# 权限测试接口文档

> 模块：`system:permission-test`  |  接口数：1（3 mode）  |  Spec-A1（v2.8）

## 一、概述

提供权限调试综合工具。**一个接口三种模式**：
- **user-overview** — 用户全景（角色/权限码/菜单/统计）
- **user-check** — 单接口/权限码命中检查（含 7 种 denyReason）
- **role-check** — 角色权限矩阵 + 影响面（绑定用户数）

适用场景：
- 用户报错"我点不动按钮" → user-check
- 给新用户分配角色后审视 → user-overview
- 设计/调整角色后回归验收 → role-check

## 二、接口清单

| 方法 | 路径 | 权限码 |
|------|------|--------|
| GET | `/api/admin/permissions/test` | `system:permission-test:run` |

## 三、Mode 1: user-overview

**Query**: `mode=user-overview&userId=<id>`

**Response：**
```json
{
  "code": 200,
  "data": {
    "user": { "id": 2, "username": "operator", "nickname": "Op", "status": 1 },
    "roles": [{ "id": 3, "code": "operator", "name": "运营管理员" }],
    "isSuperAdmin": false,
    "permissionCodes": ["dashboard","tool","tool:menu","tool:list", "..."],
    "menus": [/* MenuNode[]，结构同 /api/admin/auth/menus */],
    "stats": {
      "totalCodes": 31,
      "totalMenus": 7,
      "byModule": { "tool": 8, "category": 4, "feedback": 5, "stats": 5, "user": 6, "member": 3 }
    }
  }
}
```

## 四、Mode 2: user-check

**Query 形态 A**（按权限码）：`mode=user-check&userId=<id>&code=<perm-code>`

**Query 形态 B**（按 API）：`mode=user-check&userId=<id>&path=<api-path>&method=<HTTP-method>`

**Response（命中）：**
```json
{
  "code": 200,
  "data": {
    "user": { "id": 1, "username": "admin" },
    "target": {
      "type": "code", "code": "tool:create",
      "permissionExists": true, "permissionId": 56, "permissionName": "创建工具"
    },
    "allowed": true,
    "matchedRoles": [{ "id": 1, "code": "admin", "name": "管理员" }],
    "matchedPermissions": [{ "id": 56, "code": "tool:create", "via": "role:admin" }],
    "denyReason": null
  }
}
```

**Response（拒绝）：** `allowed: false`、`matchedRoles/matchedPermissions: []`、`denyReason` 取下表枚举：

| denyReason | 触发条件 |
|---|---|
| `user_not_found` | userId 对应用户不存在 |
| `user_disabled` | 用户 status≠1 |
| `no_roles` | 用户未绑定任何角色（含已过期角色） |
| `permission_not_exists` | code/api 在 permissions 表不存在 |
| `permission_disabled` | 权限码 status≠1 |
| `permission_not_granted` | 角色未授予该权限码 |

> **super_admin 短路**：直接返回 `allowed=true`、`matchedPermissions=[{via:'super_admin_short_circuit'}]`，不再继续后续检查。

> **注：** spec §5.1 列出 7 种 denyReason，但 `roles_disabled` 在实现中由 `service.role.getUserRoles()` SQL 层 `where status=1` 提前过滤，因此实际只暴露 6 种。

## 五、Mode 3: role-check

**Query**: `mode=role-check&roleCode=<code>` 或 `&roleId=<id>`

**Response：**
```json
{
  "code": 200,
  "data": {
    "role": { "id": 4, "code": "auditor", "name": "审计员", "status": 1 },
    "ownedCodes": ["dashboard","stats:overview","system:audit-log","..."],
    "permissionTree": [/* 仅含 owned 节点的树 */],
    "stats": {
      "total": 24,
      "byModule": { "stats": 5, "system": 8, "tool": 5 },
      "byType": { "menu": 9, "api": 15 }
    },
    "boundUserCount": 3
  }
}
```

`stats.byType` 取值：`menu`（type=2）/ `api`（type=4）/ `group`（type=1，目录）/ `typeN`（其他）

## 六、错误码

| HTTP | code | message |
|---|---|---|
| 422 | 422 | `unknown mode: <xxx>` / `userId required` / `code or (path+method) required` / `roleCode or roleId required` |
| 401 | 401 | 未登录 |
| 403 | 403 | 缺 `system:permission-test:run` 权限（仅 super_admin / admin / auditor 默认拥有） |

## 七、实现要点

- 同一接口通过 `mode` query 参数路由到 service 不同方法
- `path+method` 反查权限码：用 `permissions` 表 `idx_path_method` 复合索引（init.sql line 293），**path 严格相等匹配**（不做占位符模糊解析）
- super_admin 短路：在角色检查阶段最先判定，跳过 permission/code 各项检查
- `matchedRoles` 通过 `roles ⨝ role_permissions ⨝ permissions ⨝ user_roles` 联合查询得到

## 八、相关文档

- [Spec-A1 设计文档 §5](../../superpowers/specs/2026-05-11-审计基础设施与权限测试设计文档.md#五permission-test-service-详细设计)
- [permission-test e2e 测试](../../test/api/permission-test.test.ts)
