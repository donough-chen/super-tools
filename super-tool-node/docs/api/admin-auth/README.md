# 管理端用户自查接口（Admin Auth）

> 路由前缀：`/api/admin/auth` | 中间件：`auth`（仅校验登录，**不挂 perm**）

## 接口列表

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/admin/auth/menus` | 当前用户菜单树（type=2，已过滤+剪枝） |
| GET | `/api/admin/auth/permissions` | 当前用户扁平权限码（含 type=2/3/4） |

---

## 1. GET /api/admin/auth/menus

请求头：`Authorization: Bearer <accessToken>`

响应示例：
```json
{
  "code": 200,
  "message": "ok",
  "data": [
    {
      "id": 1,
      "code": "dashboard",
      "name": "仪表盘",
      "module": "dashboard",
      "path": "/dashboard",
      "icon": "DashboardOutlined",
      "sort": 10,
      "children": []
    },
    {
      "id": 2,
      "code": "system",
      "name": "系统管理",
      "module": "system",
      "path": "/system",
      "icon": "SettingOutlined",
      "sort": 90,
      "children": [
        {
          "id": 11,
          "code": "system:role",
          "name": "角色管理",
          "module": "system",
          "path": "/system/role",
          "icon": null,
          "sort": 10,
          "children": []
        }
      ]
    }
  ]
}
```

字段说明：

| 字段 | 类型 | 说明 |
|------|------|------|
| id | number | permissions.id |
| code | string | 权限码（前端 AuthWrapper 校验匹配） |
| name | string | 菜单显示名 |
| module | string | 所属模块 |
| path | string | 与前端 react-router pathname 严格一致 |
| icon | string \| null | AntD Icon 名称（仅顶级菜单非空） |
| sort | number | 排序 |
| children | MenuNode[] | 子菜单 |

业务规则：
- 仅返回 `type=2` + `status=1` + `platform='admin'`
- super_admin 角色短路：返回所有菜单
- 父节点子菜单全被剪光 → 父节点也剪掉

---

## 2. GET /api/admin/auth/permissions

请求头：`Authorization: Bearer <accessToken>`

响应示例：
```json
{
  "code": 200,
  "message": "ok",
  "data": [
    "dashboard",
    "dashboard:view",
    "user",
    "user:menu",
    "user:list"
  ]
}
```

复用 `service.permission.getUserPermissionCodes(userId)`，含 Redis 缓存。

---

## 设计参考

- [Spec-B 管理端 RBAC 基础设施设计文档](../../superpowers/specs/2026-05-11-管理端RBAC基础设施设计文档.md) §4.1-4.5
- [Spec-B 实施计划](../../superpowers/plans/2026-05-11-管理端RBAC基础设施实施计划.md) Task 3
