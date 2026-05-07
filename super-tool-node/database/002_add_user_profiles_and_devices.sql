-- ============================================================
-- 迁移脚本: 002_add_user_profiles_and_devices.sql
-- 版本: 2.1.0
-- 创建时间: 2026-04-10
-- 说明: 新增用户扩展信息表和设备管理表 + 全平台认证系统配置数据
-- ============================================================

USE `superadmin_db`;

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- ------------------------------------------------------------
-- 1. 用户扩展信息表（C端个人资料 + 偏好设置）
-- 策略: 1:1 关联 users 表，不修改主表
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `user_profiles` (
  `id`                    BIGINT UNSIGNED   NOT NULL AUTO_INCREMENT,
  `user_id`               BIGINT UNSIGNED   NOT NULL COMMENT '关联用户ID（唯一）',
  -- 个人资料
  `bio`                   VARCHAR(200)      DEFAULT NULL COMMENT '个人简介',
  `signature`             VARCHAR(100)      DEFAULT NULL COMMENT '个人签名',
  `region_code`           VARCHAR(20)       DEFAULT NULL COMMENT '所在地区行政编码',
  `language`              VARCHAR(10)       NOT NULL DEFAULT 'zh-CN' COMMENT '语言偏好',
  `timezone`              VARCHAR(50)       NOT NULL DEFAULT 'Asia/Shanghai' COMMENT '时区',
  -- 营销裂变
  `referral_code`         VARCHAR(20)       DEFAULT NULL COMMENT '我的邀请码（唯一）',
  `invited_by`            BIGINT UNSIGNED   DEFAULT NULL COMMENT '邀请人用户ID',
  -- 偏好设置（JSON 灵活扩展）
  `privacy_settings`      JSON              DEFAULT NULL COMMENT '隐私设置',
  `notification_settings` JSON              DEFAULT NULL COMMENT '通知偏好设置',
  `created_at`            DATETIME          NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`            DATETIME          NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_user_id`       (`user_id`),
  UNIQUE KEY `uk_referral_code` (`referral_code`),
  INDEX `idx_invited_by`        (`invited_by`),
  INDEX `idx_region_code`       (`region_code`),
  CONSTRAINT `fk_profile_user` FOREIGN KEY (`user_id`)
    REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='用户扩展信息表';


-- ------------------------------------------------------------
-- 2. 用户设备表（支持多设备管理）
-- 策略: 1:N 关联 users 表
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `user_devices` (
  `id`              BIGINT UNSIGNED   NOT NULL AUTO_INCREMENT,
  `user_id`         BIGINT UNSIGNED   NOT NULL COMMENT '用户ID',
  `device_id`       VARCHAR(100)      NOT NULL COMMENT '设备唯一标识',
  `device_name`     VARCHAR(100)      DEFAULT NULL COMMENT '设备名称',
  `device_type`     VARCHAR(20)       NOT NULL COMMENT '设备类型:ios/android/web/h5/miniprogram',
  `os_version`      VARCHAR(50)       DEFAULT NULL COMMENT '系统版本',
  `app_version`     VARCHAR(20)       DEFAULT NULL COMMENT '应用版本',
  `push_token`      VARCHAR(500)      DEFAULT NULL COMMENT '推送Token(FCM/APNs)',
  `push_enabled`    TINYINT(1)        NOT NULL DEFAULT 1 COMMENT '是否开启推送',
  `last_active_at`  DATETIME          DEFAULT NULL COMMENT '最后活跃时间',
  `status`          TINYINT UNSIGNED  NOT NULL DEFAULT 1 COMMENT '状态:0禁用,1正常',
  `created_at`      DATETIME          NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`      DATETIME          NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_user_device` (`user_id`, `device_id`),
  INDEX `idx_user_id`     (`user_id`),
  INDEX `idx_device_type` (`device_type`),
  INDEX `idx_push_token`  (`push_token`(191)),
  CONSTRAINT `fk_device_user` FOREIGN KEY (`user_id`)
    REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='用户设备表';


-- ------------------------------------------------------------
-- 3. 全平台认证相关系统配置种子数据
-- ------------------------------------------------------------
INSERT IGNORE INTO `system_configs` (`group`, `key`, `value`, `type`, `is_secret`, `is_public`, `description`) VALUES
('wechat', 'mp_appid',                '', 'string',  0, 0, '微信小程序 AppID'),
('wechat', 'mp_secret',               '', 'string',  1, 0, '微信小程序 Secret'),
('wechat', 'h5_appid',                '', 'string',  0, 0, '微信公众号 AppID'),
('wechat', 'h5_secret',               '', 'string',  1, 0, '微信公众号 Secret'),
('wechat', 'open_appid',              '', 'string',  0, 0, '微信开放平台 AppID'),
('wechat', 'open_secret',             '', 'string',  1, 0, '微信开放平台 Secret'),
('sms',    'provider',                'tencent', 'string',  0, 0, '短信服务商'),
('sms',    'daily_limit',             '10', 'number', 0, 0, '单号码每日短信限额'),
('auth',   'phone_login_auto_register', 'true', 'boolean', 0, 0, '手机号登录时自动注册新用户'),
('auth',   'wechat_login_auto_register','true', 'boolean', 0, 0, '微信登录时自动注册新用户');


SET FOREIGN_KEY_CHECKS = 1;
