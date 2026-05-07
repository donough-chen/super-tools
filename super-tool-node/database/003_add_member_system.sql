-- ============================================================
-- 迁移脚本: 003_add_member_system.sql
-- 版本: 2.2.0
-- 创建时间: 2026-04-15
-- 说明: 新增会员等级体系（成长等级 + 付费会员 + 积分流水）
-- 设计方案: 方案 B「单表融合」
-- ============================================================

USE `superadmin_db`;

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;


-- ------------------------------------------------------------
-- 1. 成长等级定义表
-- 策略: 静态配置表，后台管理维护
-- 预设: 5 级（普通 → 银牌 → 金牌 → 钻石 → 黑金）
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `member_levels` (
  `id`              INT UNSIGNED      NOT NULL AUTO_INCREMENT,
  `name`            VARCHAR(50)       NOT NULL COMMENT '等级名称',
  `code`            VARCHAR(30)       NOT NULL COMMENT '等级编码（free/silver/gold/diamond/black）',
  `level`           TINYINT UNSIGNED  NOT NULL COMMENT '等级数值（0-9，越大越高）',
  `icon`            VARCHAR(500)      DEFAULT NULL COMMENT '等级图标 URL',
  `color`           VARCHAR(20)       DEFAULT NULL COMMENT '等级主题色（#HEX）',
  `upgrade_points`  INT UNSIGNED      NOT NULL DEFAULT 0 COMMENT '升级所需累计积分',
  `upgrade_growth`  INT UNSIGNED      NOT NULL DEFAULT 0 COMMENT '升级所需成长值',
  `upgrade_consume` DECIMAL(10,2)     NOT NULL DEFAULT 0.00 COMMENT '升级所需累计消费金额',
  `benefits`        JSON              DEFAULT NULL COMMENT '成长等级权益配置',
  `description`     VARCHAR(500)      DEFAULT NULL COMMENT '等级描述',
  `sort`            INT               NOT NULL DEFAULT 0 COMMENT '排序',
  `status`          TINYINT UNSIGNED  NOT NULL DEFAULT 1 COMMENT '状态:0禁用,1启用',
  `created_at`      DATETIME          NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`      DATETIME          NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_code`  (`code`),
  UNIQUE KEY `uk_level` (`level`),
  INDEX `idx_status`    (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='成长等级定义表';


-- ------------------------------------------------------------
-- 2. 付费套餐定义表
-- 策略: 静态配置表，后台管理维护
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `paid_plans` (
  `id`              INT UNSIGNED      NOT NULL AUTO_INCREMENT,
  `name`            VARCHAR(50)       NOT NULL COMMENT '套餐名称',
  `code`            VARCHAR(30)       NOT NULL COMMENT '套餐编码（monthly/quarterly/yearly/lifetime）',
  `duration_days`   INT UNSIGNED      NOT NULL DEFAULT 0 COMMENT '有效天数（0=终身）',
  `price`           DECIMAL(10,2)     NOT NULL DEFAULT 0.00 COMMENT '售价（元）',
  `original_price`  DECIMAL(10,2)     NOT NULL DEFAULT 0.00 COMMENT '原价（元）',
  `benefits`        JSON              DEFAULT NULL COMMENT '付费会员额外权益配置',
  `gift_points`     INT UNSIGNED      NOT NULL DEFAULT 0 COMMENT '购买赠送积分',
  `gift_growth`     INT UNSIGNED      NOT NULL DEFAULT 0 COMMENT '购买赠送成长值',
  `description`     VARCHAR(500)      DEFAULT NULL COMMENT '套餐描述',
  `sort`            INT               NOT NULL DEFAULT 0 COMMENT '排序',
  `status`          TINYINT UNSIGNED  NOT NULL DEFAULT 1 COMMENT '状态:0下架,1上架',
  `created_at`      DATETIME          NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`      DATETIME          NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_code` (`code`),
  INDEX `idx_status`   (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='付费套餐定义表';


-- ------------------------------------------------------------
-- 3. 用户会员状态表（融合成长等级 + 付费会员）
-- 策略: 1:1 关联 users 表，一人一行
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `user_members` (
  `id`              BIGINT UNSIGNED   NOT NULL AUTO_INCREMENT,
  `user_id`         BIGINT UNSIGNED   NOT NULL COMMENT '用户ID（唯一）',
  -- 成长等级
  `level_id`        INT UNSIGNED      NOT NULL DEFAULT 1 COMMENT '当前成长等级ID',
  `level_code`      VARCHAR(30)       NOT NULL DEFAULT 'free' COMMENT '当前成长等级编码（冗余）',
  `growth_value`    INT UNSIGNED      NOT NULL DEFAULT 0 COMMENT '成长值（只增不减）',
  `total_points`    INT UNSIGNED      NOT NULL DEFAULT 0 COMMENT '历史累计积分（只增不减）',
  `total_consume`   DECIMAL(12,2)     NOT NULL DEFAULT 0.00 COMMENT '历史累计消费金额',
  -- 积分
  `points`          INT UNSIGNED      NOT NULL DEFAULT 0 COMMENT '当前可用积分',
  -- 付费会员
  `is_paid`         TINYINT(1)        NOT NULL DEFAULT 0 COMMENT '是否付费会员:0否,1是',
  `paid_plan_code`  VARCHAR(30)       DEFAULT NULL COMMENT '当前付费套餐编码',
  `paid_start_at`   DATETIME          DEFAULT NULL COMMENT '付费会员开始时间',
  `paid_expire_at`  DATETIME          DEFAULT NULL COMMENT '付费会员到期时间（NULL=终身）',
  -- 等级有效期
  `level_expire_at` DATETIME          DEFAULT NULL COMMENT '成长等级有效期（NULL=永久）',
  `created_at`      DATETIME          NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`      DATETIME          NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_user_id`      (`user_id`),
  INDEX `idx_level_id`         (`level_id`),
  INDEX `idx_level_code`       (`level_code`),
  INDEX `idx_is_paid`          (`is_paid`),
  INDEX `idx_paid_expire`      (`paid_expire_at`),
  CONSTRAINT `fk_member_user` FOREIGN KEY (`user_id`)
    REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='用户会员状态表';


-- ------------------------------------------------------------
-- 4. 积分流水表（只追加不修改，无 updated_at）
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `points_logs` (
  `id`            BIGINT UNSIGNED   NOT NULL AUTO_INCREMENT,
  `user_id`       BIGINT UNSIGNED   NOT NULL COMMENT '用户ID',
  `type`          TINYINT UNSIGNED  NOT NULL COMMENT '类型:1获得,2消耗,3过期,4管理员调整',
  `source`        VARCHAR(50)       NOT NULL COMMENT '来源:register/daily_login/order/activity/exchange/admin/paid_gift',
  `points`        INT               NOT NULL COMMENT '积分变动（正数获得，负数消耗）',
  `balance`       INT UNSIGNED      NOT NULL COMMENT '变动后积分余额',
  `growth_delta`  INT               NOT NULL DEFAULT 0 COMMENT '成长值变动',
  `biz_type`      VARCHAR(50)       DEFAULT NULL COMMENT '关联业务类型',
  `biz_id`        VARCHAR(64)       DEFAULT NULL COMMENT '关联业务ID',
  `remark`        VARCHAR(200)      DEFAULT NULL COMMENT '备注',
  `expire_at`     DATETIME          DEFAULT NULL COMMENT '积分过期时间',
  `created_at`    DATETIME          NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_user_id`    (`user_id`),
  INDEX `idx_type`       (`type`),
  INDEX `idx_source`     (`source`),
  INDEX `idx_biz`        (`biz_type`, `biz_id`),
  INDEX `idx_created_at` (`created_at`),
  INDEX `idx_expire_at`  (`expire_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='积分流水表';


-- ============================================================
-- 种子数据
-- ============================================================

-- 成长等级（5级）
INSERT IGNORE INTO `member_levels` (`name`, `code`, `level`, `color`, `upgrade_points`, `upgrade_growth`, `upgrade_consume`, `benefits`, `description`, `sort`) VALUES
('普通会员', 'free',    0, '#999999', 0,     0,     0.00,  '{"discount":1.00,"daily_sign_points":1,"max_devices":3,"ad_free":false,"priority_support":false,"exclusive_content":false,"monthly_coupon":0}', '注册即享，基础权益', 0),
('银牌会员', 'silver',  1, '#C0C0C0', 500,   500,   0.00,  '{"discount":0.98,"daily_sign_points":2,"max_devices":5,"ad_free":false,"priority_support":false,"exclusive_content":false,"monthly_coupon":1}', '活跃用户，享受小额优惠', 1),
('金牌会员', 'gold',    2, '#FFD700', 2000,  2000,  0.00,  '{"discount":0.95,"daily_sign_points":3,"max_devices":8,"ad_free":true,"priority_support":false,"exclusive_content":true,"monthly_coupon":2}', '核心用户，无广告+专属内容', 2),
('钻石会员', 'diamond', 3, '#00BFFF', 5000,  5000,  0.00,  '{"discount":0.90,"daily_sign_points":5,"max_devices":10,"ad_free":true,"priority_support":true,"exclusive_content":true,"monthly_coupon":3}', '忠实用户，9折+优先客服', 3),
('黑金会员', 'black',   4, '#1A1A1A', 10000, 10000, 0.00,  '{"discount":0.85,"daily_sign_points":10,"max_devices":20,"ad_free":true,"priority_support":true,"exclusive_content":true,"monthly_coupon":5}', '顶级用户，最大折扣+全部特权', 4);

-- 付费套餐（4种）
INSERT IGNORE INTO `paid_plans` (`name`, `code`, `duration_days`, `price`, `original_price`, `benefits`, `gift_points`, `gift_growth`, `description`, `sort`) VALUES
('月度会员', 'monthly',   30,  6.80,  9.90,   '{"discount_extra":0.05,"cloud_storage_gb":10,"api_rate_limit":1000,"export_pdf":true,"custom_theme":true}', 50, 100, '按月订阅，灵活开通', 0),
('季度会员', 'quarterly', 90,  16.80, 29.90,  '{"discount_extra":0.05,"cloud_storage_gb":30,"api_rate_limit":3000,"export_pdf":true,"custom_theme":true}', 200, 400, '季度订阅，性价比之选', 1),
('年度会员', 'yearly',    365, 39.90, 96.80,  '{"discount_extra":0.08,"cloud_storage_gb":100,"api_rate_limit":10000,"export_pdf":true,"custom_theme":true,"early_access":true}', 1000, 2000, '年度订阅，超值推荐', 2),
('终身会员', 'lifetime',  0,   99.00, 199.00, '{"discount_extra":0.10,"cloud_storage_gb":-1,"api_rate_limit":-1,"export_pdf":true,"custom_theme":true,"early_access":true,"founder_badge":true}', 5000, 10000, '一次购买，终身享用', 3);

-- 会员体系系统配置
INSERT IGNORE INTO `system_configs` (`group`, `key`, `value`, `type`, `is_secret`, `is_public`, `description`) VALUES
('member', 'auto_create_on_register', 'true',  'boolean', 0, 0, '用户注册时自动创建会员记录'),
('member', 'register_gift_points',    '10',    'number',  0, 0, '注册赠送积分'),
('member', 'register_gift_growth',    '10',    'number',  0, 0, '注册赠送成长值'),
('member', 'daily_login_points',      '1',     'number',  0, 0, '每日登录赠送基础积分'),
('member', 'daily_login_growth',      '1',     'number',  0, 0, '每日登录赠送基础成长值'),
('member', 'level_auto_upgrade',      'true',  'boolean', 0, 0, '是否自动升级等级');


SET FOREIGN_KEY_CHECKS = 1;
