# 数据库表结构文档

> 更新于 2026/4/10

本文档记录 `superadmin_db` 数据库中所有业务表的结构设计。

---

## 📋 表清单

| 表名 | 说明 | 迁移脚本 |
|------|------|----------|
| `users` | 用户主表 | `001_init.sql` |
| `user_roles` | 用户-角色关联表 | `001_init.sql` |
| `user_sessions` | 用户会话管理表 | `001_init.sql` |
| `user_oauths` | 第三方OAuth绑定表 | `001_init.sql` |
| `user_addresses` | 用户地址表 | `001_init.sql` |
| `roles` | 角色表 | `001_init.sql` |
| `permissions` | 权限表 | `001_init.sql` |
| `role_permissions` | 角色-权限关联表 | `001_init.sql` |
| `oauth_clients` | OAuth 客户端配置表 | `001_init.sql` |
| `login_logs` | 登录日志表 | `001_init.sql` |
| `system_configs` | 系统配置表 | `001_init.sql` |
| `user_profiles` | 用户扩展信息表 | `002_add_user_profiles_and_devices.sql` |
| `user_devices` | 用户设备管理表 | `002_add_user_profiles_and_devices.sql` |

---

## user_profiles — 用户扩展信息表

> 迁移脚本: `002_add_user_profiles_and_devices.sql`
> 关联策略: 1:1 关联 `users` 表，不修改主表

| 字段 | 类型 | 空 | 默认值 | 说明 |
|------|------|------|--------|------|
| `id` | BIGINT UNSIGNED | NOT NULL | AUTO_INCREMENT | 主键 |
| `user_id` | BIGINT UNSIGNED | NOT NULL | — | 关联用户ID（唯一） |
| `bio` | VARCHAR(200) | NULL | NULL | 个人简介 |
| `signature` | VARCHAR(100) | NULL | NULL | 个人签名 |
| `region_code` | VARCHAR(20) | NULL | NULL | 所在地区行政编码 |
| `language` | VARCHAR(10) | NOT NULL | 'zh-CN' | 语言偏好 |
| `timezone` | VARCHAR(50) | NOT NULL | 'Asia/Shanghai' | 时区 |
| `referral_code` | VARCHAR(20) | NULL | NULL | 邀请码（唯一） |
| `invited_by` | BIGINT UNSIGNED | NULL | NULL | 邀请人用户ID |
| `privacy_settings` | JSON | NULL | NULL | 隐私设置 |
| `notification_settings` | JSON | NULL | NULL | 通知偏好设置 |
| `created_at` | DATETIME | NOT NULL | CURRENT_TIMESTAMP | 创建时间 |
| `updated_at` | DATETIME | NOT NULL | CURRENT_TIMESTAMP ON UPDATE | 更新时间 |

**索引：**
- `PRIMARY KEY (id)`
- `UNIQUE KEY uk_user_id (user_id)`
- `UNIQUE KEY uk_referral_code (referral_code)`
- `INDEX idx_invited_by (invited_by)`
- `INDEX idx_region_code (region_code)`

**外键：**
- `fk_profile_user`: `user_id` → `users.id` (CASCADE)

**对应 Model:** `app/model/user_profile.ts`

---

## user_devices — 用户设备管理表

> 迁移脚本: `002_add_user_profiles_and_devices.sql`
> 关联策略: 1:N 关联 `users` 表

| 字段 | 类型 | 空 | 默认值 | 说明 |
|------|------|------|--------|------|
| `id` | BIGINT UNSIGNED | NOT NULL | AUTO_INCREMENT | 主键 |
| `user_id` | BIGINT UNSIGNED | NOT NULL | — | 用户ID |
| `device_id` | VARCHAR(100) | NOT NULL | — | 设备唯一标识 |
| `device_name` | VARCHAR(100) | NULL | NULL | 设备名称 |
| `device_type` | VARCHAR(20) | NOT NULL | — | 设备类型: ios/android/web/h5/miniprogram |
| `os_version` | VARCHAR(50) | NULL | NULL | 系统版本 |
| `app_version` | VARCHAR(20) | NULL | NULL | 应用版本 |
| `push_token` | VARCHAR(500) | NULL | NULL | 推送Token (FCM/APNs) |
| `push_enabled` | TINYINT(1) | NOT NULL | 1 | 是否开启推送 |
| `last_active_at` | DATETIME | NULL | NULL | 最后活跃时间 |
| `status` | TINYINT UNSIGNED | NOT NULL | 1 | 状态: 0=禁用, 1=正常 |
| `created_at` | DATETIME | NOT NULL | CURRENT_TIMESTAMP | 创建时间 |
| `updated_at` | DATETIME | NOT NULL | CURRENT_TIMESTAMP ON UPDATE | 更新时间 |

**索引：**
- `PRIMARY KEY (id)`
- `UNIQUE KEY uk_user_device (user_id, device_id)`
- `INDEX idx_user_id (user_id)`
- `INDEX idx_device_type (device_type)`
- `INDEX idx_push_token (push_token(191))`

**外键：**
- `fk_device_user`: `user_id` → `users.id` (CASCADE)

**对应 Model:** `app/model/user_device.ts`

---

## 迁移记录

| 序号 | 脚本文件 | 说明 | 日期 |
|------|----------|------|------|
| 001 | `001_init.sql` | 初始化所有核心表 | 2026-04-01 |
| 002 | `002_add_user_profiles_and_devices.sql` | 新增用户扩展信息表和设备管理表 + 全平台认证系统配置种子数据 | 2026-04-10 |

### 002 迁移种子数据

迁移脚本 002 同时在 `system_configs` 表中插入了以下全平台认证相关配置：

| group | key | 说明 |
|-------|-----|------|
| wechat | mp_appid | 微信小程序 AppID |
| wechat | mp_secret | 微信小程序 Secret |
| wechat | h5_appid | 微信公众号 AppID |
| wechat | h5_secret | 微信公众号 Secret |
| wechat | open_appid | 微信开放平台 AppID |
| wechat | open_secret | 微信开放平台 Secret |
| sms | provider | 短信服务商（默认 tencent） |
| sms | daily_limit | 单号码每日短信限额（默认 10） |
| auth | phone_login_auto_register | 手机号登录时自动注册新用户 |
| auth | wechat_login_auto_register | 微信登录时自动注册新用户 |
