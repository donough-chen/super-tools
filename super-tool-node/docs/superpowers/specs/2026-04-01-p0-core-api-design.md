# P0 核心 API 设计文档

> 版本: 1.0 | 日期: 2026-04-01 | 状态: approved

> ⚠️ **部分更新（2026-05-12）**：用户列表 `GET /api/users` 的 `userType` 筛选参数已废弃，改为 `registerSource`（注册来源平台）。详见 [user_type 重构设计文档](./2026-05-12-user-type-refactor-design.md)。

## 范围
对齐 init.sql v2.0，重写 用户体系+SSO认证+RBAC权限，13张表。

## Model（13个）
User, UserOauth, UserVerification, UserAddress, OauthClient, UserSession, VerifyCode, LoginLog, Role, Permission, UserRole, RolePermission, UserPermission

## API 列表

### 认证 /api/auth（无需登录）
- POST /login — client_id+密码登录，写session+login_logs
- POST /register — 注册+分配默认角色
- POST /refresh — 刷新Token（查session表）
- POST /logout — 标记session失效（需登录）
- POST /send-code — 发验证码
- GET /sessions — 用户所有会话（需登录）
- DELETE /sessions/:id — 踢掉会话（需登录）

### 用户 /api/users（需登录）
- GET / — 列表（keyword/status/userType）
- GET /:id — 详情
- POST / — 创建
- PUT /:id — 更新
- DELETE /:id — 软删除
- GET /profile — 当前用户
- PUT /password — 改密码
- CRUD /addresses — 地址管理

### 角色 /api/admin/roles（需登录+权限）
- CRUD + PUT /:id/permissions 批量设置权限

### 权限 /api/admin/permissions（需登录+权限）
- CRUD + GET /tree 权限树

### Dashboard /api/admin/dashboard
- GET / — 统计数据

## SSO 认证流程
1. 客户端传 client_id+client_secret → 查 oauth_clients 获取 TTL
2. 验证用户密码 → 生成 JWT → 写 user_sessions
3. auth 中间件：验JWT → 查 session is_active → 放行
4. 登出：session.is_active=0
5. 所有登录/失败写 login_logs
