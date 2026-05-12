# user_type 字段重构设计文档

**日期**: 2026-05-12  
**状态**: 待实施

## 1. 背景与目标

### 问题
`users.user_type` (TINYINT: 1=普通用户, 2=管理员, 3=超级管理员) 与 `roles` 表功能重叠：
- `checkPermission` 中间件通过 `userType === 3` 短路绕过 RBAC
- JWT payload 包含 `userType`，`/api/auth/me` 接口用 `userType === 3` 标记 `isSuperAdmin`
- `permission.isSuperAdmin()` 使用 userType + 角色码双重判定
- 管理端 UI 将 userType 作为"用户类型"展示和筛选

### 目标
1. **`user_type` 标记为废弃**，不再用于任何权限判断
2. **用户来源平台** 由已有的 `register_source` 字段承担（值与 `oauth_clients.platform` 一致：web/h5/miniprogram/ios/android/admin）
3. **所有权限判断统一走 RBAC**：通过 `user_roles` + `roles.code = 'super_admin'` 判定超管

## 2. 变更清单

### 2.1 后端 (super-tool-node)

| 文件 | 变更 |
|------|------|
| `app/middleware/checkPermission.ts` | 移除 `userType === 3` 短路，改为查 `super_admin` 角色 |
| `app/service/permission.ts` | `isSuperAdmin()` 移除 userType 判定分支，仅保留角色码判定 |
| `app/service/auth.ts:createSession()` | JWT payload 移除 `userType` 字段 |
| `app/controller/auth.ts:me()` | `isSuperAdmin` 改为基于角色码判定 |
| `app/service/user.ts:create()` | 移除 `userType` 参数，管理端创建用户不再设置 userType |
| `app/service/user.ts:findList()` | 将 `userType` 筛选改为 `registerSource` 筛选 |
| `app/controller/user.ts:index()` | 查询参数 `userType` 改为 `registerSource` |
| `app/model/user.ts` | `userType` 字段添加 `@deprecated` 注释 |
| `typings/index.d.ts` | `state.user` 移除 `userType` 字段 |

### 2.2 管理端 (super-tools-admin)

| 文件 | 变更 |
|------|------|
| `src/utils/userType.ts` | `USER_TYPE_LABELS` 改为 `REGISTER_SOURCE_LABELS` 平台映射 |
| `src/services/user.ts` | 类型定义 `userType` → `registerSource`，查询参数同步调整 |
| `src/pages/User/List/index.tsx` | 筛选器和表格列 `userType` → `registerSource` |
| `src/pages/User/List/UserModal.tsx` | 移除 userType 下拉（管理端创建用户不再选"类型"） |
| `src/pages/User/List/BasicInfoTab.tsx` | 用户详情 "用户类型" → "注册来源" |
| `typings.d.ts` | `CurrentUser.userType` 移除 |

### 2.3 数据库迁移 (010_deprecate_user_type.sql)

- `user_type` 字段 COMMENT 更新为 `'@deprecated 已废弃，权限请查 user_roles 表'`
- 无需数据迁移（`register_source` 已在注册时正确设置）

## 3. 不变更项

- `user_type` 字段 **不删除**（保持向后兼容）
- `register_source` 字段 **不改名**（已正确存在）
- `006_add_rbac_init.sql` 历史迁移脚本 **不修改**
- `roles` 表结构和功能 **不变**

## 4. 风险与注意

- `checkPermission` 改为异步查角色会增加一次 DB/缓存查询，但 `isSuperAdmin` 已有缓存机制，影响可忽略
- JWT payload 移除 `userType` 后，旧 token 仍包含该字段，不影响（读取时忽略即可）
- 测试文件中的 `userType` 引用需同步更新
