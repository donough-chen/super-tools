# Database 目录说明

本目录存放 super-tool-node 的数据库初始化脚本与各版本迁移脚本。

## 文件清单

| 文件 | 说明 |
|---|---|
| `init.sql` | 全量初始化脚本（裸库首次部署用） |
| `数据库设计方案.md` | 整体表结构设计文档 |
| `002_add_user_profiles_and_devices.sql` | v2.0 用户档案 + 设备管理 |
| `003_add_member_system.sql` | v2.1 会员体系 |
| `004_add_tools_system.sql` | v2.2 工具/分类系统 |
| `005_add_user_favorites.sql` | v2.4 用户收藏工具 |
| `006_add_rbac_init.sql` | v2.5 RBAC 初始化（5 角色 + 61 权限码） |
| `007_add_member_module.sql` | v2.6 RBAC 扩展（member 模块 +11 权限码，总数升至 72） |

## 执行顺序

裸库首次部署：

```bash
mysql -u <user> -p < init.sql
mysql -u <user> -p < 002_add_user_profiles_and_devices.sql
mysql -u <user> -p < 003_add_member_system.sql
mysql -u <user> -p < 004_add_tools_system.sql
mysql -u <user> -p < 005_add_user_favorites.sql
mysql -u <user> -p < 006_add_rbac_init.sql
mysql -u <user> -p < 007_add_member_module.sql
```

存量库升级：仅执行需要升级的迁移脚本（按文件名前缀编号顺序）。

---

## v2.5 RBAC 初始化说明（006_add_rbac_init.sql）

### 设计目标

引入完整的 RBAC（Role-Based Access Control）体系，统一管理端权限：

- **5 个系统角色**：`super_admin` / `admin` / `operator` / `auditor` / `user`
  - `super_admin` 中间件短路，不需要在 `role_permissions` 表写入记录
  - `user` 仅作 Web/H5 端默认占位，**不可登录管理端**
- **61 条权限码**，分 7 大模块：`dashboard / system / user / category / tool / feedback / stats`
- 存量用户按 `users.user_type` 自动绑定到对应系统角色

### 关键变更

1. **`permissions` 表新增 `module` 字段**（`VARCHAR(50)`），用于按模块分组与缓存失效
   ```sql
   ALTER TABLE `permissions`
     ADD COLUMN `module` VARCHAR(50) NOT NULL DEFAULT '' AFTER `type`,
     ADD INDEX `idx_module` (`module`);
   ```
2. **`roles` 表新增 `auditor` 系统角色**（`type=1`，platform=admin）
3. **`permissions.type` 与 spec 的对应关系**
   - `1` = 目录（dir）
   - `2` = 菜单（menu）
   - `3` = 按钮（button）
   - `4` = API
4. **`permissions.parent_id`**：`0` 表示顶级，子节点通过 `(SELECT id FROM permissions WHERE code = ...)` 关联

### 角色 × 权限映射

| 角色 | 权限数 | 范围 |
|---|---|---|
| `super_admin` | 0（短路） | 全部，由中间件直接放行 |
| `admin` | 47 | dashboard + system 只读+permission-test + user 全部除分配角色/直接授权 + category/tool/feedback/stats 全部 |
| `operator` | 31 | dashboard + user 只读 + category/tool/feedback 全部 + stats 不含 export |
| `auditor` | 27 | 全只读 + system 只读 + audit-log 完整（含 export） |
| `user` | 0 | 占位，无管理端权限 |
| `guest` | 0 | 保留访客角色，无 RBAC 权限 |

### 存量数据迁移

| 现有 user_type | 自动绑定角色 |
|---|---|
| `3` 超级管理员 | `super_admin` |
| `2` 普通管理员 | `admin` |
| `1` 普通用户 | `user` |

> `user_type` 字段保留**逐步废弃**策略，后续业务代码统一走 `roles` 判断。

### 幂等性

脚本顶部会先清理：

1. 所有 `type=1` 系统角色与权限的关联（`role_permissions`）
2. 所有 `type=1` 系统角色与用户的绑定（`user_roles`）
3. 7 大系统模块下的所有权限（`permissions WHERE module IN (...)`）
4. 旧版 `auditor` 角色（防 code 冲突）

随后再重建 → 脚本可重复执行，**不会重复插入或破坏业务自定义角色**。

### 执行步骤（生产/staging）

```bash
# 1. 备份（必须！）
mysqldump -u <user> -p superadmin_db roles permissions role_permissions user_roles users \
  > backup_before_rbac_$(date +%Y%m%d_%H%M%S).sql

# 2. 先在 staging 跑通迁移
mysql -u <user> -p superadmin_db < 006_add_rbac_init.sql

# 3. 数据校验（见脚本末尾的 SELECT 校验语句）
mysql -u <user> -p superadmin_db -e "
SELECT module, COUNT(*) AS cnt FROM permissions
  WHERE module IN ('dashboard','system','user','category','tool','feedback','stats')
  GROUP BY module ORDER BY cnt DESC;
"
# 期望输出：system=21  user=11  tool=10  stats=6  category=6  feedback=5  dashboard=2
# 总计 61 条

mysql -u <user> -p superadmin_db -e "
SELECT r.code, COUNT(rp.permission_id) AS cnt FROM roles r
  LEFT JOIN role_permissions rp ON rp.role_id = r.id
  WHERE r.type = 1 GROUP BY r.id, r.code ORDER BY cnt DESC;
"
# 期望输出：admin=47  operator=31  auditor=27  super_admin=0  user=0  guest=0

# 4. 重启服务（清 Redis 权限缓存）
pm2 restart super-tool-node
# 或手动清缓存：
# redis-cli --scan --pattern "user:permissions:*" | xargs redis-cli DEL
# redis-cli --scan --pattern "user:roles:*" | xargs redis-cli DEL
```

### 回滚方案

```bash
# 1. 还原备份
mysql -u <user> -p superadmin_db < backup_before_rbac_<timestamp>.sql

# 2. 移除新增的 module 字段（如需彻底回滚 schema）
mysql -u <user> -p superadmin_db -e "
ALTER TABLE permissions DROP INDEX idx_module;
ALTER TABLE permissions DROP COLUMN module;
"

# 3. 清理 Redis 缓存
redis-cli FLUSHDB   # 仅在专用 DB 上执行；多业务共用时改为 SCAN+DEL

# 4. 重启服务
pm2 restart super-tool-node
```

### 注意事项

- ⚠️ 脚本会**清空所有系统角色（type=1）的 user_roles 绑定**后按 user_type 重建。若线上存在「人工特别绑定的系统角色（例如手工把某个 user_type=1 的用户绑成 admin）」会被覆盖，迁移前需确认或单独留存。
- ⚠️ MySQL 5.7 不支持 `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`，重复执行迁移脚本会因为 `module` 列已存在而失败。生产环境建议在执行前用 `SHOW COLUMNS FROM permissions LIKE 'module'` 检查；如已存在，**注释掉脚本第一节的 ALTER TABLE 后再执行**。
- ⚠️ `role_permissions` 表无外键级联，删除/重建顺序错误会留下孤儿数据 → 脚本严格按"先关联表后主表"清理。
- 迁移完成后需要让现有登录用户重新登录或主动清缓存，否则 JWT 内存的旧 user_type 与 RBAC 不一致。

### 相关文档

- [RBAC 权限体系架构](../docs/architecture/RBAC.md) — 5 角色 / 72 权限码 / 中间件流程 / 缓存策略
- [添加新权限指南](../docs/guides/添加新权限指南.md) — 新增权限码 + 路由挂载 SOP
- 测试覆盖：[`test/api/rbac.test.ts`](../test/api/rbac.test.ts)

---

## v2.6 member 模块权限化（007_add_member_module.sql）

### 背景

v2.5（006）落地了 7 大模块共 61 条权限码，但 `/api/admin/member/*` 11 条管理端路由仍是裸 `auth` 放行，**任意登录用户都可以调积分调整、套餐激活等高敏接口**，构成安全漏洞。本次迁移将 member 模块纳入 RBAC 体系。

### 变更摘要

- **新增 11 条权限码**（`module='member'`）：1 个顶级菜单 + 10 个 API
- **角色映射**：admin 11 条 / operator 6 条只读 / auditor 6 条只读（含积分流水审计）
- **不涉及 schema 变更**，仅数据写入
- **幂等**：脚本顶部按 `module='member'` 清理后重建，可重复执行

### 角色映射要点

| 类别 | admin | operator | auditor |
|---|:---:|:---:|:---:|
| 等级/套餐/用户 列表查看 | ✓ | ✓ | ✓ |
| 等级/套餐 编辑 | ✓ | – | – |
| **积分调整 / 等级调整 / 套餐激活**（高敏） | ✓ | – | – |
| 统计 / 积分流水查看 | ✓ | ✓ | ✓ |

### 执行步骤

```bash
# 1. 备份（可选，本次仅写入数据，不改 schema）
mysqldump -u <user> -p superadmin_db permissions role_permissions \
  > backup_before_007_$(date +%Y%m%d_%H%M%S).sql

# 2. 执行迁移
mysql -u <user> -p superadmin_db < 007_add_member_module.sql

# 3. 校验
mysql -u <user> -p superadmin_db -e "
SELECT COUNT(*) FROM permissions WHERE module = 'member';
"
# 期望：11

mysql -u <user> -p superadmin_db -e "
SELECT r.code, COUNT(rp.permission_id) AS cnt FROM roles r
  INNER JOIN role_permissions rp ON rp.role_id = r.id
  INNER JOIN permissions p ON p.id = rp.permission_id
  WHERE p.module = 'member' AND r.type = 1
  GROUP BY r.id, r.code ORDER BY cnt DESC;
"
# 期望：admin=11  operator=6  auditor=6

# 4. 重启服务（清 Redis 权限缓存）
pm2 restart super-tool-node
```

### 注意事项

- 仅 admin 及以上角色登录后能继续访问 member 管理端，**operator/auditor 此前若被绑定且依赖 member 写操作的工作流，需要重新梳理**
- 该迁移**不影响 C 端** `/api/member/*` 路由（用户自查接口未挂权限）
