# API 接口总览

> 更新于 2026/5/8 (新增用户收藏工具模块)

共 **82** 个接口

## 认证模块 (Auth) [查看文档](auth/README.md)

| 方法 | 路径 | 认证 |
|------|------|------|
| `POST` | `/api/auth/login` | ❌ |
| `POST` | `/api/auth/wechat-login` | ❌ |
| `POST` | `/api/auth/phone-login` | ❌ |
| `GET` | `/api/auth/wechat-auth-url` | ❌ |
| `POST` | `/api/auth/register` | ❌ |
| `POST` | `/api/auth/refresh` | ❌ |
| `POST` | `/api/auth/send-code` | ❌ |
| `POST` | `/api/auth/logout` | ✅ |
| `GET` | `/api/auth/sessions` | ✅ |
| `DELETE` | `/api/auth/sessions/:id` | ✅ |
| `POST` | `/api/auth/bind/phone` | ✅ |
| `POST` | `/api/auth/bind/wechat` | ✅ |
| `POST` | `/api/auth/bind/email` | ✅ |
| `POST` | `/api/auth/unbind` | ✅ |
| `GET` | `/api/auth/bind-status` | ✅ |

## 用户模块 (User) [查看文档](user/README.md)

| 方法 | 路径 | 认证 |
|------|------|------|
| `GET` | `/api/users/profile` | ✅ |
| `GET` | `/api/users/profile/extra` | ✅ |
| `PUT` | `/api/users/profile` | ✅ |
| `PUT` | `/api/users/password` | ✅ |
| `GET` | `/api/users/addresses` | ✅ |
| `POST` | `/api/users/addresses` | ✅ |
| `PUT` | `/api/users/addresses/:id` | ✅ |
| `DELETE` | `/api/users/addresses/:id` | ✅ |
| `POST` | `/api/users/devices` | ✅ |
| `GET` | `/api/users/devices` | ✅ |
| `DELETE` | `/api/users/devices/:deviceId` | ✅ |
| `PUT` | `/api/users/devices/:deviceId/push` | ✅ |
| `GET` | `/api/users` | ✅ |
| `GET` | `/api/users/:id` | ✅ |
| `POST` | `/api/users` | ✅ |
| `PUT` | `/api/users/:id` | ✅ |
| `DELETE` | `/api/users/:id` | ✅ |

## 角色管理 (Role) [查看文档](role/README.md)

| 方法 | 路径 | 认证 |
|------|------|------|
| `GET` | `/api/admin/roles` | ✅ |
| `GET` | `/api/admin/roles/:id` | ✅ |
| `POST` | `/api/admin/roles` | ✅ |
| `PUT` | `/api/admin/roles/:id` | ✅ |
| `DELETE` | `/api/admin/roles/:id` | ✅ |
| `PUT` | `/api/admin/roles/:id/permissions` | ✅ |

## 权限管理 (Permission) [查看文档](permission/README.md)

| 方法 | 路径 | 认证 |
|------|------|------|
| `GET` | `/api/admin/permissions/tree` | ✅ |
| `GET` | `/api/admin/permissions/:id` | ✅ |
| `POST` | `/api/admin/permissions` | ✅ |
| `PUT` | `/api/admin/permissions/:id` | ✅ |
| `DELETE` | `/api/admin/permissions/:id` | ✅ |

## 仪表盘 (Dashboard) [查看文档](dashboard/README.md)

| 方法 | 路径 | 认证 |
|------|------|------|
| `GET` | `/api/admin/dashboard` | ✅ |

## 会员模块 (Member) [查看文档](member/README.md)

| 方法 | 路径 | 认证 |
|------|------|------|
| `GET` | `/api/member/levels` | ❌ |
| `GET` | `/api/member/plans` | ❌ |
| `GET` | `/api/member/info` | ✅ |
| `GET` | `/api/member/benefits` | ✅ |
| `GET` | `/api/member/points-logs` | ✅ |
| `POST` | `/api/member/daily-sign` | ✅ |
| `GET` | `/api/admin/member/levels` | ✅ |
| `PUT` | `/api/admin/member/levels/:id` | ✅ |
| `GET` | `/api/admin/member/plans` | ✅ |
| `PUT` | `/api/admin/member/plans/:id` | ✅ |
| `GET` | `/api/admin/member/users` | ✅ |
| `GET` | `/api/admin/member/users/:id` | ✅ |
| `POST` | `/api/admin/member/users/:id/adjust-points` | ✅ |
| `PUT` | `/api/admin/member/users/:id/level` | ✅ |
| `POST` | `/api/admin/member/users/:id/activate-plan` | ✅ |
| `GET` | `/api/admin/member/stats` | ✅ |
| `GET` | `/api/admin/member/points-logs` | ✅ |

## 工具模块 - H5 端 (Tool) [查看文档](tool/README.md)

| 方法 | 路径 | 认证 |
|------|------|------|
| `GET` | `/api/tools/home` | ❌ |
| `GET` | `/api/tools/feature` | ❌ |
| `GET` | `/api/tools/member` | ❌ |
| `GET` | `/api/tools/:code/access` | ✅ |

## 工具管理 - 管理端 (Admin Tool) [查看文档](admin-tool/README.md)

| 方法 | 路径 | 认证 |
|------|------|------|
| `GET` | `/api/admin/tool-categories` | ✅ |
| `POST` | `/api/admin/tool-categories` | ✅ |
| `PUT` | `/api/admin/tool-categories/:id` | ✅ |
| `DELETE` | `/api/admin/tool-categories/:id` | ✅ |
| `GET` | `/api/admin/tools` | ✅ |
| `GET` | `/api/admin/tools/:id` | ✅ |
| `POST` | `/api/admin/tools` | ✅ |
| `PUT` | `/api/admin/tools/:id` | ✅ |
| `DELETE` | `/api/admin/tools/:id` | ✅ |
| `PUT` | `/api/admin/tools/batch-publish` | ✅ |

## 用户收藏工具 (Favorite) [查看文档](favorite/README.md)

| 方法 | 路径 | 认证 |
|------|------|------|
| `POST` | `/api/favorites` | ✅ |
| `DELETE` | `/api/favorites/:toolCode` | ✅ |
| `GET` | `/api/favorites` | ✅ |
| `GET` | `/api/favorites/codes` | ✅ |
| `GET` | `/api/favorites/check/:toolCode` | ✅ |
| `PUT` | `/api/favorites/reorder` | ✅ |
