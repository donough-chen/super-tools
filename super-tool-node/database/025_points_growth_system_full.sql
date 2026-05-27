-- ============================================================================
-- 迁移脚本: 025_points_growth_system_full.sql （合并部署版）
-- 版本: 2.3.3 (consolidated)
-- 创建时间: 2026-05-27
-- 整合自:
--   - 025_add_points_growth_system.sql           (v2.3.0 核心表+种子+权限)
--   - 025b_seed_points_notification_templates.sql (v2.3.2 通知模板)
--   - 026_fix_points_permissions_type.sql        (v2.3.1 权限类型修复)
--
-- 设计依据:
--   - docs/analysis/积分与成长体系深度评估报告.md
--   - docs/superpowers/plans/2026-05-26-积分成长体系MVP实施计划-v2.md
--   - docs/superpowers/plans/2026-05-26-积分成长体系MVP实施计划-v2-续篇.md
--
-- 适用场景:
--   ✅ 全新环境一次性部署：直接 source 本文件即可
--   ✅ 已部署 025 / 025b / 026 的环境：本文件是幂等的（IF NOT EXISTS / INSERT IGNORE
--      / NOT EXISTS / UPDATE WHERE type<>4），重复执行无副作用
--
-- 执行:
--   mysql -u root -p superadmin_db < database/025_points_growth_system_full.sql
--
-- 回滚:
--   本脚本无 DROP 语句以避免误删数据。如需回滚 schema，请手动执行：
--     DROP TABLE points_daily_snapshots, points_expiry_notices, points_expiry_logs,
--                daily_points_caps, points_mall_orders, points_mall_items,
--                user_signs, task_completion_logs, user_tasks, tasks;
--     ALTER TABLE points_logs DROP COLUMN points_remaining, DROP COLUMN status,
--                              DROP COLUMN source_level_id, DROP COLUMN source_event,
--                              DROP COLUMN growth_multiplier;
--     ALTER TABLE user_members DROP COLUMN sign_streak, DROP COLUMN last_sign_date,
--                               DROP COLUMN total_sign_days;
--     DELETE FROM permissions WHERE module='points';
--   并对应清理 system_configs / notification_types / notification_templates 中
--   group='points' / code LIKE 'BUSINESS_POINTS%' 的记录。
-- ============================================================================

USE `superadmin_db`;

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;


-- ============================================================================
-- §0  部署前置检查（仅打印提示，不阻断执行）
-- ============================================================================
-- 0.1 必要前置依赖：003_add_member_system.sql 已执行（含 member_levels / paid_plans /
--     user_members / points_logs 4 张表）；018_add_notification_system.sql 已执行
--     （含 notification_types / notification_templates）；permissions / role_permissions
--     由初始化脚本提供
SELECT
  CONCAT('precheck.member_levels    : ', IF(COUNT(*)>0, 'OK', 'MISSING - run 003_add_member_system.sql first')) AS msg
FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'member_levels'
UNION ALL SELECT
  CONCAT('precheck.points_logs     : ', IF(COUNT(*)>0, 'OK', 'MISSING - run 003_add_member_system.sql first'))
FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'points_logs'
UNION ALL SELECT
  CONCAT('precheck.notification_types: ', IF(COUNT(*)>0, 'OK', 'MISSING - run 018_add_notification_system.sql first'))
FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'notification_types'
UNION ALL SELECT
  CONCAT('precheck.permissions     : ', IF(COUNT(*)>0, 'OK', 'MISSING - run base init.sql first'))
FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'permissions';


-- ============================================================================
-- §1  ALTER 现有表（幂等：列已存在时跳过）
-- ============================================================================

-- 1.1 points_logs 融合 FIFO 字段（单表承担"流水 + 批次"双职责）
--     已存在则跳过（用 INFORMATION_SCHEMA 判断）
SET @col_exists := (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'points_logs'
    AND column_name = 'points_remaining'
);
SET @sql := IF(@col_exists = 0,
  'ALTER TABLE `points_logs`
     ADD COLUMN `points_remaining`  INT UNSIGNED      NOT NULL DEFAULT 0
       COMMENT ''剩余可用积分（仅 type=1 时有效，FIFO 消耗）''                     AFTER `balance`,
     ADD COLUMN `status`            TINYINT UNSIGNED  NOT NULL DEFAULT 1
       COMMENT ''状态:1可用,2已耗尽,3已过期,4已退款回收（仅 type=1 时有效）''      AFTER `points_remaining`,
     ADD COLUMN `source_level_id`   INT UNSIGNED      DEFAULT NULL
       COMMENT ''获得时的等级ID（用于计算过期时长）''                              AFTER `status`,
     ADD COLUMN `source_event`      VARCHAR(50)       DEFAULT NULL
       COMMENT ''触发事件 code（task_claim/order_paid/sign/admin_adjust 等）''   AFTER `source_level_id`,
     ADD COLUMN `growth_multiplier` DECIMAL(4,2)      NOT NULL DEFAULT 1.00
       COMMENT ''获得时应用的等级积分倍率（用于退款回算）''                        AFTER `source_event`,
     ADD INDEX `idx_user_status_expire` (`user_id`, `status`, `expire_at`),
     ADD INDEX `idx_status_expire` (`status`, `expire_at`)',
  'SELECT ''§1.1 points_logs FIFO columns already exist, skipped'' AS msg'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 1.2 user_members 签到 3 字段
SET @col_exists := (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'user_members'
    AND column_name = 'sign_streak'
);
SET @sql := IF(@col_exists = 0,
  'ALTER TABLE `user_members`
     ADD COLUMN `sign_streak`     INT UNSIGNED NOT NULL DEFAULT 0 COMMENT ''当前连续签到天数''   AFTER `points`,
     ADD COLUMN `last_sign_date`  DATE         DEFAULT NULL       COMMENT ''最后签到日期''       AFTER `sign_streak`,
     ADD COLUMN `total_sign_days` INT UNSIGNED NOT NULL DEFAULT 0 COMMENT ''累计签到总天数''     AFTER `last_sign_date`',
  'SELECT ''§1.2 user_members sign columns already exist, skipped'' AS msg'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;


-- ============================================================================
-- §2  CREATE TABLE — 积分体系新增 10 张表（IF NOT EXISTS 幂等）
-- ============================================================================

-- 2.1 任务定义表
CREATE TABLE IF NOT EXISTS `tasks` (
  `id`              INT UNSIGNED      NOT NULL AUTO_INCREMENT,
  `code`            VARCHAR(50)       NOT NULL COMMENT '任务唯一码',
  `name`            VARCHAR(100)      NOT NULL COMMENT '任务名称',
  `icon`            VARCHAR(500)      DEFAULT NULL,
  `description`     VARCHAR(500)      DEFAULT NULL,
  `category`        ENUM('newbie','daily','weekly','monthly','yearly','achievement','activity') NOT NULL,
  `trigger_event`   VARCHAR(50)       NOT NULL COMMENT '监听的领域事件 code',
  `condition`       JSON              DEFAULT NULL COMMENT '过滤条件（JSON）',
  `progress_target` INT UNSIGNED      NOT NULL DEFAULT 1,
  `progress_type`   TINYINT UNSIGNED  NOT NULL DEFAULT 1
    COMMENT '进度计算:1计数累加,2去重计数,3累计金额阈值,4直接覆盖（连续天数）',
  `reward_points`   INT UNSIGNED      NOT NULL DEFAULT 0,
  `reward_growth`   INT UNSIGNED      NOT NULL DEFAULT 0,
  `reward_extra`    JSON              DEFAULT NULL,
  `reset_cycle`     ENUM('once','daily','weekly','monthly','yearly') NOT NULL DEFAULT 'once',
  `valid_from`      DATETIME          DEFAULT NULL,
  `valid_to`        DATETIME          DEFAULT NULL,
  `required_level`  VARCHAR(30)       DEFAULT NULL,
  `daily_cap_group` VARCHAR(30)       DEFAULT NULL COMMENT '日上限分组(task/invite)',
  `expire_days`     INT UNSIGNED      DEFAULT NULL COMMENT '任务自身过期天数（如新手任务30天）',
  `sort`            INT               NOT NULL DEFAULT 0,
  `status`          TINYINT UNSIGNED  NOT NULL DEFAULT 1,
  `created_at`      DATETIME          NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`      DATETIME          NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_code` (`code`),
  INDEX `idx_trigger_event` (`trigger_event`),
  INDEX `idx_category_status` (`category`, `status`),
  INDEX `idx_status_sort` (`status`, `sort`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='任务定义表';

-- 2.2 用户任务进度表
CREATE TABLE IF NOT EXISTS `user_tasks` (
  `id`            BIGINT UNSIGNED   NOT NULL AUTO_INCREMENT,
  `user_id`       BIGINT UNSIGNED   NOT NULL,
  `task_code`     VARCHAR(50)       NOT NULL,
  `cycle_key`     VARCHAR(20)       NOT NULL COMMENT '周期键(once/2026-05-26/2026-W21/2026-05/2026)',
  `progress`      INT UNSIGNED      NOT NULL DEFAULT 0,
  `progress_meta` JSON              DEFAULT NULL COMMENT '辅助元数据（去重值集合/累计金额/连续天数等）',
  `status`        ENUM('pending','completed','claimed','expired') NOT NULL DEFAULT 'pending',
  `expire_at`     DATETIME          DEFAULT NULL COMMENT '任务到期时间（覆盖任务自身 expire_days）',
  `completed_at`  DATETIME          DEFAULT NULL,
  `claimed_at`    DATETIME          DEFAULT NULL,
  `created_at`    DATETIME          NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`    DATETIME          NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_user_task_cycle` (`user_id`, `task_code`, `cycle_key`),
  INDEX `idx_user_status` (`user_id`, `status`),
  INDEX `idx_status_completed` (`status`, `completed_at`),
  INDEX `idx_expire_at` (`expire_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='用户任务进度表';

-- 2.3 任务完成记录表（领奖前的"已完成快照"，便于补发与审计）
CREATE TABLE IF NOT EXISTS `task_completion_logs` (
  `id`            BIGINT UNSIGNED   NOT NULL AUTO_INCREMENT,
  `user_task_id`  BIGINT UNSIGNED   NOT NULL,
  `user_id`       BIGINT UNSIGNED   NOT NULL,
  `task_code`     VARCHAR(50)       NOT NULL,
  `cycle_key`     VARCHAR(20)       NOT NULL,
  `reward_points` INT UNSIGNED      NOT NULL DEFAULT 0 COMMENT '已应用等级加成后的实发积分',
  `reward_growth` INT UNSIGNED      NOT NULL DEFAULT 0,
  `bonus_rate`    DECIMAL(4,2)      NOT NULL DEFAULT 1.00 COMMENT '等级任务加成倍率',
  `status`        ENUM('pending','rewarded','failed') NOT NULL DEFAULT 'pending',
  `points_log_id` BIGINT UNSIGNED   DEFAULT NULL COMMENT '关联 points_logs.id（积分发放后回填）',
  `error_msg`     VARCHAR(500)      DEFAULT NULL,
  `retry_count`   INT UNSIGNED      NOT NULL DEFAULT 0,
  `next_retry_at` DATETIME          DEFAULT NULL,
  `created_at`    DATETIME          NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`    DATETIME          NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_user_task_id` (`user_task_id`),
  INDEX `idx_status_retry` (`status`, `next_retry_at`),
  INDEX `idx_user_id` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='任务完成记录（补发用）';

-- 2.4 用户签到记录表
CREATE TABLE IF NOT EXISTS `user_signs` (
  `id`              BIGINT UNSIGNED  NOT NULL AUTO_INCREMENT,
  `user_id`         BIGINT UNSIGNED  NOT NULL,
  `sign_date`       DATE             NOT NULL,
  `streak`          INT UNSIGNED     NOT NULL DEFAULT 1,
  `points_earned`   INT UNSIGNED     NOT NULL DEFAULT 0,
  `growth_earned`   INT UNSIGNED     NOT NULL DEFAULT 0,
  `level_id`        INT UNSIGNED     DEFAULT NULL COMMENT '签到时等级（用于审计）',
  `created_at`      DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_user_date` (`user_id`, `sign_date`),
  INDEX `idx_user_streak` (`user_id`, `streak`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='用户签到记录';

-- 2.5 积分商城商品表
CREATE TABLE IF NOT EXISTS `points_mall_items` (
  `id`              INT UNSIGNED      NOT NULL AUTO_INCREMENT,
  `name`            VARCHAR(100)      NOT NULL,
  `icon`            VARCHAR(500)      DEFAULT NULL,
  `description`     VARCHAR(500)      DEFAULT NULL,
  `category`        ENUM('coupon','member_days','tool_unlock','badge','physical') NOT NULL
    COMMENT '商品类型（physical 实物，预留）',
  `is_virtual`      TINYINT(1)        NOT NULL DEFAULT 1 COMMENT '是否虚拟商品（0=实物，预留）',
  `cost_points`     INT UNSIGNED      NOT NULL,
  `required_level`  VARCHAR(30)       DEFAULT NULL,
  `fulfill_config`  JSON              NOT NULL COMMENT '履约配置（含 type / params）',
  `stock`           INT               NOT NULL DEFAULT -1 COMMENT '库存(-1=无限)',
  `daily_limit`     INT UNSIGNED      NOT NULL DEFAULT 0,
  `total_limit`     INT UNSIGNED      NOT NULL DEFAULT 0,
  `valid_from`      DATETIME          DEFAULT NULL,
  `valid_to`        DATETIME          DEFAULT NULL,
  `sort`            INT               NOT NULL DEFAULT 0,
  `status`          TINYINT UNSIGNED  NOT NULL DEFAULT 1,
  `created_at`      DATETIME          NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`      DATETIME          NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_category_status` (`category`, `status`),
  INDEX `idx_status_sort` (`status`, `sort`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='积分商城商品';

-- 2.6 积分商城兑换订单表（含商品快照 + 实物预留列）
CREATE TABLE IF NOT EXISTS `points_mall_orders` (
  `id`                BIGINT UNSIGNED   NOT NULL AUTO_INCREMENT,
  `order_no`          VARCHAR(32)       NOT NULL,
  `user_id`           BIGINT UNSIGNED   NOT NULL,
  `item_id`           INT UNSIGNED      NOT NULL,
  `cost_points`       INT UNSIGNED      NOT NULL,
  `product_snapshot`  JSON              NOT NULL COMMENT '商品快照（name/icon/category/fulfill_config/cost_points 等）',
  `points_log_id`     BIGINT UNSIGNED   DEFAULT NULL COMMENT '扣分流水ID',
  `fulfill_status`    ENUM('pending','fulfilled','shipping','failed','refunded') NOT NULL DEFAULT 'pending',
  `fulfill_result`    JSON              DEFAULT NULL,
  `fulfilled_at`      DATETIME          DEFAULT NULL,
  -- 实物字段预留（虚拟商品时全部 NULL）
  `receiver_name`     VARCHAR(50)       DEFAULT NULL,
  `receiver_phone`    VARCHAR(20)       DEFAULT NULL,
  `receiver_address`  VARCHAR(500)      DEFAULT NULL,
  `express_company`   VARCHAR(50)       DEFAULT NULL,
  `express_no`        VARCHAR(50)       DEFAULT NULL,
  `shipped_at`        DATETIME          DEFAULT NULL,
  -- 退款字段
  `refund_status`     ENUM('none','requested','approved','rejected','refunded') NOT NULL DEFAULT 'none',
  `refund_reason`     VARCHAR(200)      DEFAULT NULL,
  `refunded_at`       DATETIME          DEFAULT NULL,
  `created_at`        DATETIME          NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`        DATETIME          NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_order_no` (`order_no`),
  INDEX `idx_user_created` (`user_id`, `created_at`),
  INDEX `idx_item_id` (`item_id`),
  INDEX `idx_fulfill_status` (`fulfill_status`),
  INDEX `idx_refund_status` (`refund_status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='积分商城兑换订单';

-- 2.7 每日积分获取上限
CREATE TABLE IF NOT EXISTS `daily_points_caps` (
  `id`        BIGINT UNSIGNED  NOT NULL AUTO_INCREMENT,
  `user_id`   BIGINT UNSIGNED  NOT NULL,
  `cap_date`  DATE             NOT NULL,
  `cap_group` VARCHAR(30)      NOT NULL COMMENT 'task/invite',
  `earned`    INT UNSIGNED     NOT NULL DEFAULT 0,
  `count`     INT UNSIGNED     NOT NULL DEFAULT 0 COMMENT '次数（邀请类用）',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_user_date_group` (`user_id`, `cap_date`, `cap_group`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='每日上限';

-- 2.8 积分过期执行记录（独立于 points_logs，记录每次过期任务执行明细）
CREATE TABLE IF NOT EXISTS `points_expiry_logs` (
  `id`              BIGINT UNSIGNED   NOT NULL AUTO_INCREMENT,
  `user_id`         BIGINT UNSIGNED   NOT NULL,
  `source_log_id`   BIGINT UNSIGNED   NOT NULL COMMENT '源积分流水ID(points_logs.id)',
  `expired_points`  INT UNSIGNED      NOT NULL,
  `expired_log_id`  BIGINT UNSIGNED   DEFAULT NULL COMMENT '回写的过期流水ID',
  `executed_at`     DATETIME          NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_source_log` (`source_log_id`),
  INDEX `idx_user_executed` (`user_id`, `executed_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='积分过期执行记录';

-- 2.9 积分过期提醒幂等表（防止 T-30/T-7/T-0 重复发送）
CREATE TABLE IF NOT EXISTS `points_expiry_notices` (
  `id`            BIGINT UNSIGNED   NOT NULL AUTO_INCREMENT,
  `user_id`       BIGINT UNSIGNED   NOT NULL,
  `notice_date`   DATE              NOT NULL COMMENT '提醒发送日期',
  `notice_stage`  TINYINT UNSIGNED  NOT NULL COMMENT '阶段:1=T-30,2=T-7,3=T-0',
  `expire_date`   DATE              NOT NULL COMMENT '关联的过期日',
  `points_amount` INT UNSIGNED      NOT NULL,
  `channels`      JSON              DEFAULT NULL COMMENT '已发送渠道列表',
  `created_at`    DATETIME          NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_user_stage_expire` (`user_id`, `notice_stage`, `expire_date`),
  INDEX `idx_notice_date` (`notice_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='过期提醒幂等';

-- 2.10 日终对账快照
CREATE TABLE IF NOT EXISTS `points_daily_snapshots` (
  `id`                  BIGINT UNSIGNED   NOT NULL AUTO_INCREMENT,
  `snapshot_date`       DATE              NOT NULL,
  `user_id`             BIGINT UNSIGNED   NOT NULL,
  `points_balance`      INT UNSIGNED      NOT NULL DEFAULT 0 COMMENT 'user_members.points 实际值',
  `theoretical_balance` BIGINT            NOT NULL DEFAULT 0 COMMENT '由流水累加的理论值',
  `diff`                BIGINT            NOT NULL DEFAULT 0 COMMENT '实际 - 理论',
  `growth_value`        INT UNSIGNED      NOT NULL DEFAULT 0,
  `level_id`            INT UNSIGNED      NOT NULL,
  `is_anomaly`          TINYINT(1)        NOT NULL DEFAULT 0 COMMENT '是否对账异常',
  `created_at`          DATETIME          NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_user_date` (`user_id`, `snapshot_date`),
  INDEX `idx_snapshot_date` (`snapshot_date`),
  INDEX `idx_anomaly` (`is_anomaly`, `snapshot_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='日终对账快照';


-- ============================================================================
-- §3  种子数据：等级权益扩展（写入 member_levels.benefits）
--     评估报告 §4.2 / §4.3 / §4.4
--     幂等：JSON_MERGE_PATCH 幂等覆盖（重复跑值不变）
-- ============================================================================
UPDATE `member_levels` SET `benefits` = JSON_MERGE_PATCH(IFNULL(`benefits`, JSON_OBJECT()),
  JSON_OBJECT('points_multiplier',1.00,'task_bonus_rate',0.00,'sign_base_points',1, 'points_expire_days',365,'upgrade_gift_points',0,   'upgrade_gift_growth',0,'deduct_limit',0.05)
) WHERE `code` = 'free';

UPDATE `member_levels` SET `benefits` = JSON_MERGE_PATCH(IFNULL(`benefits`, JSON_OBJECT()),
  JSON_OBJECT('points_multiplier',1.10,'task_bonus_rate',0.05,'sign_base_points',2, 'points_expire_days',365,'upgrade_gift_points',200, 'upgrade_gift_growth',0,'deduct_limit',0.10)
) WHERE `code` = 'silver';

UPDATE `member_levels` SET `benefits` = JSON_MERGE_PATCH(IFNULL(`benefits`, JSON_OBJECT()),
  JSON_OBJECT('points_multiplier',1.30,'task_bonus_rate',0.10,'sign_base_points',3, 'points_expire_days',456,'upgrade_gift_points',500, 'upgrade_gift_growth',0,'deduct_limit',0.20)
) WHERE `code` = 'gold';

UPDATE `member_levels` SET `benefits` = JSON_MERGE_PATCH(IFNULL(`benefits`, JSON_OBJECT()),
  JSON_OBJECT('points_multiplier',2.00,'task_bonus_rate',0.30,'sign_base_points',5, 'points_expire_days',730,'upgrade_gift_points',2000,'upgrade_gift_growth',0,'deduct_limit',0.30)
) WHERE `code` = 'diamond';

UPDATE `member_levels` SET `benefits` = JSON_MERGE_PATCH(IFNULL(`benefits`, JSON_OBJECT()),
  JSON_OBJECT('points_multiplier',3.00,'task_bonus_rate',0.50,'sign_base_points',10,'points_expire_days',730,'upgrade_gift_points',5000,'upgrade_gift_growth',0,'deduct_limit',0.50)
) WHERE `code` = 'black';


-- ============================================================================
-- §4  种子数据：任务定义（17 条 — 评估报告行为矩阵）
--     幂等：tasks.code 唯一键 + INSERT IGNORE
-- ============================================================================

-- §4.1 新手任务（30 天过期）
INSERT IGNORE INTO `tasks` (`code`,`name`,`description`,`category`,`trigger_event`,`progress_target`,`progress_type`,`reward_points`,`reward_growth`,`reset_cycle`,`expire_days`,`sort`) VALUES
('newbie_profile',         '完善个人资料',  '完善头像/昵称/手机号', 'newbie','profile_completed', 1,1, 20, 5,'once',30,10),
('newbie_first_tool',      '首次使用工具',  '使用任意一个工具',     'newbie','tool_used',         1,1, 20, 5,'once',30,20),
('newbie_first_favorite',  '首次收藏工具',  '收藏任意一个工具',     'newbie','tool_favorited',    1,1, 20, 5,'once',30,30);

-- §4.2 每日任务
INSERT IGNORE INTO `tasks` (`code`,`name`,`description`,`category`,`trigger_event`,`condition`,`progress_target`,`progress_type`,`reward_points`,`reward_growth`,`reset_cycle`,`daily_cap_group`,`sort`) VALUES
('daily_use_tool',         '每日使用工具',  '今日使用任意工具1次', 'daily','tool_used',NULL,1,1,5,0,'daily','task',10),
('daily_use_3_tools',      '工具达人',      '今日使用3个不同工具', 'daily','tool_used','{"distinct_field":"tool_code"}',3,2,15,0,'daily','task',20),
('daily_sign',             '每日签到',      '签到一次',           'daily','sign',NULL,1,1,1,0,'daily',NULL,5);

-- §4.3 成就任务（progress_type=4 直接覆盖 streak / progress_type=3 累计金额阈值）
INSERT IGNORE INTO `tasks` (`code`,`name`,`description`,`category`,`trigger_event`,`condition`,`progress_target`,`progress_type`,`reward_points`,`reward_growth`,`reset_cycle`,`sort`) VALUES
('achieve_sign_7',         '连续签到7天',     '连续签到达到7天',   'achievement','sign_streak',  NULL, 7,4, 20,  0,'once',10),
('achieve_sign_30',        '连续签到30天',    '连续签到达到30天',  'achievement','sign_streak',  NULL,30,4,100, 20,'once',20),
('achieve_sign_365',       '全年签到达人',    '连续签到达到365天', 'achievement','sign_streak',  NULL,365,4,500,100,'once',30),
('achieve_first_consume',  '首次消费',       '完成首次付费消费',  'achievement','first_consume',NULL,  1,1, 50, 30,'once',40),
('achieve_first_subscribe','首次开通订阅',    '首次开通付费会员',  'achievement','first_subscribe',NULL,1,1,100, 80,'once',50),
('achieve_consume_100',    '累计消费满100元', '累计消费达到100元','achievement','consume_milestone','{"amount":100}', 100,3, 50, 30,'once',60),
('achieve_consume_500',    '累计消费满500元', '累计消费达到500元','achievement','consume_milestone','{"amount":500}', 500,3,150,100,'once',70),
('achieve_consume_2000',   '累计消费满2000元','累计消费达到2000元','achievement','consume_milestone','{"amount":2000}',2000,3,500,300,'once',80),
('achieve_invite_first_pay','邀请好友首消',   '被邀请好友首次消费','achievement','invite_first_pay',NULL,1,1,100, 80,'once',90);

-- §4.4 月度任务
INSERT IGNORE INTO `tasks` (`code`,`name`,`description`,`category`,`trigger_event`,`progress_target`,`progress_type`,`reward_points`,`reward_growth`,`reset_cycle`,`sort`) VALUES
('monthly_feedback',       '月度反馈达人',  '本月提交反馈被采纳1次', 'monthly','feedback_adopted',1,1,18,5,'monthly',10);

-- §4.5 年度任务
INSERT IGNORE INTO `tasks` (`code`,`name`,`description`,`category`,`trigger_event`,`condition`,`progress_target`,`progress_type`,`reward_points`,`reward_growth`,`reset_cycle`,`sort`) VALUES
('yearly_active',          '年度活跃用户',  '本年度登录满180天', 'yearly','daily_login','{"distinct_field":"login_date"}',180,2,200,100,'yearly',10);


-- ============================================================================
-- §5  种子数据：积分商城（7 个虚拟商品）
--     幂等：使用 INSERT ... SELECT FROM dual WHERE NOT EXISTS（points_mall_items 无业务唯一键）
-- ============================================================================
INSERT INTO `points_mall_items` (`name`,`description`,`category`,`is_virtual`,`cost_points`,`required_level`,`fulfill_config`,`stock`,`daily_limit`,`total_limit`,`sort`)
SELECT '7天会员体验','兑换7天付费会员','member_days',1,200,NULL,'{"type":"member_days","plan_code":"monthly","days":7}',-1,1,3,10 FROM dual
WHERE NOT EXISTS (SELECT 1 FROM `points_mall_items` WHERE `name` = '7天会员体验');

INSERT INTO `points_mall_items` (`name`,`description`,`category`,`is_virtual`,`cost_points`,`required_level`,`fulfill_config`,`stock`,`daily_limit`,`total_limit`,`sort`)
SELECT '30天会员','兑换30天付费会员','member_days',1,800,'silver','{"type":"member_days","plan_code":"monthly","days":30}',-1,0,0,20 FROM dual
WHERE NOT EXISTS (SELECT 1 FROM `points_mall_items` WHERE `name` = '30天会员');

INSERT INTO `points_mall_items` (`name`,`description`,`category`,`is_virtual`,`cost_points`,`required_level`,`fulfill_config`,`stock`,`daily_limit`,`total_limit`,`sort`)
SELECT '满5减1券','订单满5元可用','coupon',1,100,NULL,'{"type":"coupon","threshold":5,"discount":1,"valid_days":30}',-1,1,0,30 FROM dual
WHERE NOT EXISTS (SELECT 1 FROM `points_mall_items` WHERE `name` = '满5减1券');

INSERT INTO `points_mall_items` (`name`,`description`,`category`,`is_virtual`,`cost_points`,`required_level`,`fulfill_config`,`stock`,`daily_limit`,`total_limit`,`sort`)
SELECT '满20减5券','订单满20元可用','coupon',1,400,NULL,'{"type":"coupon","threshold":20,"discount":5,"valid_days":30}',-1,1,0,40 FROM dual
WHERE NOT EXISTS (SELECT 1 FROM `points_mall_items` WHERE `name` = '满20减5券');

INSERT INTO `points_mall_items` (`name`,`description`,`category`,`is_virtual`,`cost_points`,`required_level`,`fulfill_config`,`stock`,`daily_limit`,`total_limit`,`sort`)
SELECT '9折券','单笔订单9折','coupon',1,300,'silver','{"type":"coupon","kind":"percent","discount":0.9,"valid_days":30}',-1,1,0,50 FROM dual
WHERE NOT EXISTS (SELECT 1 FROM `points_mall_items` WHERE `name` = '9折券');

INSERT INTO `points_mall_items` (`name`,`description`,`category`,`is_virtual`,`cost_points`,`required_level`,`fulfill_config`,`stock`,`daily_limit`,`total_limit`,`sort`)
SELECT '积分达人徽章','永久收藏徽章','badge',1,500,NULL,'{"type":"badge","badge_code":"points_master"}',-1,0,1,60 FROM dual
WHERE NOT EXISTS (SELECT 1 FROM `points_mall_items` WHERE `name` = '积分达人徽章');

INSERT INTO `points_mall_items` (`name`,`description`,`category`,`is_virtual`,`cost_points`,`required_level`,`fulfill_config`,`stock`,`daily_limit`,`total_limit`,`sort`)
SELECT 'JSON Pro 7天解锁','解锁JSON工具Pro 7天','tool_unlock',1,150,NULL,'{"type":"tool_unlock","tool_code":"json_format_pro","days":7}',-1,1,0,70 FROM dual
WHERE NOT EXISTS (SELECT 1 FROM `points_mall_items` WHERE `name` = 'JSON Pro 7天解锁');


-- ============================================================================
-- §6  种子数据：系统配置
--     幂等：system_configs.uk(group,key) + INSERT IGNORE
-- ============================================================================
INSERT IGNORE INTO `system_configs` (`group`,`key`,`value`,`type`,`is_secret`,`is_public`,`description`) VALUES
('points','deduct_rate',                 '100','number',0,1,'积分抵扣比率(X积分=1元)'),
('points','daily_cap_task',              '50', 'number',0,0,'任务类每日积分上限'),
('points','daily_cap_invite',            '5',  'number',0,0,'邀请类每日结算笔数上限'),
('points','expire_remind_stages',        '30,7,0','string',0,0,'过期提醒阶段（逗号分隔）'),
('points','reconcile_threshold',         '0',  'number',0,0,'对账差异告警阈值（>0 视为异常）'),
('points','idempotency_ttl_hours',       '24', 'number',0,0,'幂等键 Redis 缓存小时数'),
('points','newbie_task_expire_days',     '30', 'number',0,0,'新手任务过期天数'),
('points','task_resend_interval_min',    '5',  'number',0,0,'任务奖励补发扫描间隔（分钟）'),
('points','snapshot_keep_days',          '180','number',0,0,'日终快照保留天数'),
('points','allow_negative_balance_for_refund','true','boolean',0,0,'退款是否允许负余额');

-- §6.1 用户回复 A' 优化：注册非长期价值行为，成长值改为 0（不影响存量用户）
UPDATE `system_configs` SET `value` = '0'
WHERE `group` = 'member' AND `key` = 'register_gift_growth';


-- ============================================================================
-- §7  权限码（管理端 11 条 API 权限）
--     注意: type=4 表示 API 类型（permissions.type 是 TINYINT，1=目录,2=菜单,3=按钮,4=API）
--     早期版本（025 first iteration）错写成字符串 'api'，已在合并版中直接用整数 4
--     幂等：permissions.uk_code + INSERT IGNORE
--     权限范式参考 018_add_notification_system.sql
-- ============================================================================
INSERT IGNORE INTO `permissions` (`name`,`code`,`type`,`module`,`path`,`method`,`sort`,`status`) VALUES
('任务列表',     'points:task:list',      4,'points','/api/admin/points/tasks',                  'GET',    1,1),
('任务创建',     'points:task:create',    4,'points','/api/admin/points/tasks',                  'POST',   2,1),
('任务更新',     'points:task:update',    4,'points','/api/admin/points/tasks/:id',              'PUT',    3,1),
('任务删除',     'points:task:delete',    4,'points','/api/admin/points/tasks/:id',              'DELETE', 4,1),
('商城商品列表', 'points:mall:list',      4,'points','/api/admin/points/mall/items',             'GET',    5,1),
('商城商品管理', 'points:mall:manage',    4,'points','/api/admin/points/mall/items',             'POST',   6,1),
('商城订单列表', 'points:mall:orders',    4,'points','/api/admin/points/mall/orders',            'GET',    7,1),
('商城订单退款', 'points:mall:refund',    4,'points','/api/admin/points/mall/orders/:id/refund', 'POST',   8,1),
('过期统计',     'points:expire:stats',   4,'points','/api/admin/points/expire/stats',           'GET',    9,1),
('对账查询',     'points:reconcile:view', 4,'points','/api/admin/points/reconcile',              'GET',   10,1),
('运维触发',     'points:ops:trigger',    4,'points','/api/admin/points/ops/trigger',            'POST',  11,1);

-- §7.1 兼容历史错误数据：若历史 025 已用字符串 'api' 写入，导致 type=0，这里强制纠正为 4
--     幂等：type 已是 4 时 UPDATE 不变更（WHERE type<>4 短路）
UPDATE `permissions`
SET `type` = 4
WHERE `module` = 'points'
  AND `code` IN (
    'points:task:list', 'points:task:create', 'points:task:update', 'points:task:delete',
    'points:mall:list', 'points:mall:manage', 'points:mall:orders', 'points:mall:refund',
    'points:expire:stats', 'points:reconcile:view', 'points:ops:trigger'
  )
  AND `type` <> 4;

-- §7.2 super_admin 默认拥有 points 模块全部权限
--     注：super_admin 中间件短路不依赖 RBAC，但记录便于权限树展示一致
INSERT IGNORE INTO `role_permissions` (`role_id`, `permission_id`)
SELECT 1, `id` FROM `permissions` WHERE `module` = 'points';


-- ============================================================================
-- §8  通知类型 + 模板（来自 025 + 025b 合并）
--     幂等：notification_types.uk_code + INSERT IGNORE
--           notification_templates.uk(code,channel,deleted_at) + NOT EXISTS 防重
-- ============================================================================

-- §8.1 通知类型（6 个 type）
--      表 uk_code 是 (code, deleted_at) 复合唯一键，NULL 视为不同值，
--      INSERT IGNORE 不能去重 → 改用 SELECT FROM dual + NOT EXISTS 守护
INSERT INTO `notification_types` (`code`,`name`,`category`,`status`)
SELECT 'BUSINESS_POINTS_EARNED','积分获得','business',1 FROM dual
WHERE NOT EXISTS (SELECT 1 FROM `notification_types` WHERE `code`='BUSINESS_POINTS_EARNED' AND `deleted_at` IS NULL);

INSERT INTO `notification_types` (`code`,`name`,`category`,`status`)
SELECT 'BUSINESS_POINTS_EXPIRE_REMIND','积分即将过期','business',1 FROM dual
WHERE NOT EXISTS (SELECT 1 FROM `notification_types` WHERE `code`='BUSINESS_POINTS_EXPIRE_REMIND' AND `deleted_at` IS NULL);

INSERT INTO `notification_types` (`code`,`name`,`category`,`status`)
SELECT 'BUSINESS_POINTS_EXPIRED','积分过期清零','business',1 FROM dual
WHERE NOT EXISTS (SELECT 1 FROM `notification_types` WHERE `code`='BUSINESS_POINTS_EXPIRED' AND `deleted_at` IS NULL);

INSERT INTO `notification_types` (`code`,`name`,`category`,`status`)
SELECT 'BUSINESS_TASK_COMPLETED','任务完成可领奖','business',1 FROM dual
WHERE NOT EXISTS (SELECT 1 FROM `notification_types` WHERE `code`='BUSINESS_TASK_COMPLETED' AND `deleted_at` IS NULL);

INSERT INTO `notification_types` (`code`,`name`,`category`,`status`)
SELECT 'BUSINESS_LEVEL_UP','等级升级','business',1 FROM dual
WHERE NOT EXISTS (SELECT 1 FROM `notification_types` WHERE `code`='BUSINESS_LEVEL_UP' AND `deleted_at` IS NULL);

INSERT INTO `notification_types` (`code`,`name`,`category`,`status`)
SELECT 'BUSINESS_MALL_FULFILLED','商城兑换到账','business',1 FROM dual
WHERE NOT EXISTS (SELECT 1 FROM `notification_types` WHERE `code`='BUSINESS_MALL_FULFILLED' AND `deleted_at` IS NULL);

-- §8.2 通知模板（7 条：6 in_app + 1 sms）
-- 范式：SELECT t.id FROM notification_types + NOT EXISTS 防重（notification_templates 在
-- (code, channel, deleted_at) 上有唯一键，重复执行不会重复插入）

-- 8.2.1 积分获得（in_app）
INSERT INTO `notification_templates`
  (`type_id`, `code`, `name`, `channel`, `title_template`, `content_template`, `current_version`, `status`, `created_by`, `description`)
SELECT t.id, 'BUSINESS_POINTS_EARNED_INAPP', '积分到账-站内信', 'in_app',
       '积分到账',
       '您获得 {{points}} 积分（来源：{{source}}），当前余额 {{balance}}。',
       1, 1, 0, '积分 v2 种子模板: 积分获得 in_app'
FROM `notification_types` t
WHERE t.code = 'BUSINESS_POINTS_EARNED'
  AND NOT EXISTS (
    SELECT 1 FROM `notification_templates`
    WHERE code = 'BUSINESS_POINTS_EARNED_INAPP' AND channel = 'in_app'
  );

-- 8.2.2 积分即将过期（in_app）
INSERT INTO `notification_templates`
  (`type_id`, `code`, `name`, `channel`, `title_template`, `content_template`, `current_version`, `status`, `created_by`, `description`)
SELECT t.id, 'BUSINESS_POINTS_EXPIRE_REMIND_INAPP', '积分即将过期-站内信', 'in_app',
       '积分即将过期',
       '您有 {{points}} 积分将在 {{expireDate}}（剩余 {{days}} 天）过期，请尽快使用。',
       1, 1, 0, '积分 v2 种子模板: 积分过期提醒 in_app'
FROM `notification_types` t
WHERE t.code = 'BUSINESS_POINTS_EXPIRE_REMIND'
  AND NOT EXISTS (
    SELECT 1 FROM `notification_templates`
    WHERE code = 'BUSINESS_POINTS_EXPIRE_REMIND_INAPP' AND channel = 'in_app'
  );

-- 8.2.3 积分即将过期（sms，仅 T-7 / T-0 用）
INSERT INTO `notification_templates`
  (`type_id`, `code`, `name`, `channel`, `title_template`, `content_template`, `current_version`, `status`, `created_by`, `description`)
SELECT t.id, 'BUSINESS_POINTS_EXPIRE_REMIND_SMS', '积分即将过期-短信', 'sms',
       NULL,
       '【超级工具】您有 {{points}} 积分将在 {{expireDate}} 过期，请尽快使用。',
       1, 1, 0, '积分 v2 种子模板: 积分过期提醒 sms'
FROM `notification_types` t
WHERE t.code = 'BUSINESS_POINTS_EXPIRE_REMIND'
  AND NOT EXISTS (
    SELECT 1 FROM `notification_templates`
    WHERE code = 'BUSINESS_POINTS_EXPIRE_REMIND_SMS' AND channel = 'sms'
  );

-- 8.2.4 积分已过期（in_app）
INSERT INTO `notification_templates`
  (`type_id`, `code`, `name`, `channel`, `title_template`, `content_template`, `current_version`, `status`, `created_by`, `description`)
SELECT t.id, 'BUSINESS_POINTS_EXPIRED_INAPP', '积分已过期-站内信', 'in_app',
       '积分已过期',
       '您的部分积分已于 {{date}} 过期清零。可前往「积分流水」查看详情。',
       1, 1, 0, '积分 v2 种子模板: 积分已过期 in_app'
FROM `notification_types` t
WHERE t.code = 'BUSINESS_POINTS_EXPIRED'
  AND NOT EXISTS (
    SELECT 1 FROM `notification_templates`
    WHERE code = 'BUSINESS_POINTS_EXPIRED_INAPP' AND channel = 'in_app'
  );

-- 8.2.5 任务完成可领奖（in_app）
INSERT INTO `notification_templates`
  (`type_id`, `code`, `name`, `channel`, `title_template`, `content_template`, `current_version`, `status`, `created_by`, `description`)
SELECT t.id, 'BUSINESS_TASK_COMPLETED_INAPP', '任务完成-站内信', 'in_app',
       '任务完成',
       '任务 [{{taskName}}] 已完成，点击领取 {{rewardPoints}} 积分奖励。',
       1, 1, 0, '积分 v2 种子模板: 任务完成 in_app'
FROM `notification_types` t
WHERE t.code = 'BUSINESS_TASK_COMPLETED'
  AND NOT EXISTS (
    SELECT 1 FROM `notification_templates`
    WHERE code = 'BUSINESS_TASK_COMPLETED_INAPP' AND channel = 'in_app'
  );

-- 8.2.6 等级升级（in_app）
INSERT INTO `notification_templates`
  (`type_id`, `code`, `name`, `channel`, `title_template`, `content_template`, `current_version`, `status`, `created_by`, `description`)
SELECT t.id, 'BUSINESS_LEVEL_UP_INAPP', '恭喜升级-站内信', 'in_app',
       '恭喜升级',
       '恭喜升级到 {{levelName}}！系统已发放 {{giftPoints}} 积分礼包。',
       1, 1, 0, '积分 v2 种子模板: 等级升级 in_app'
FROM `notification_types` t
WHERE t.code = 'BUSINESS_LEVEL_UP'
  AND NOT EXISTS (
    SELECT 1 FROM `notification_templates`
    WHERE code = 'BUSINESS_LEVEL_UP_INAPP' AND channel = 'in_app'
  );

-- 8.2.7 商城兑换到账（in_app）
INSERT INTO `notification_templates`
  (`type_id`, `code`, `name`, `channel`, `title_template`, `content_template`, `current_version`, `status`, `created_by`, `description`)
SELECT t.id, 'BUSINESS_MALL_FULFILLED_INAPP', '兑换到账-站内信', 'in_app',
       '兑换到账',
       '您兑换的 [{{itemName}}] 已发放（订单号：{{orderNo}}）。',
       1, 1, 0, '积分 v2 种子模板: 商城兑换到账 in_app'
FROM `notification_types` t
WHERE t.code = 'BUSINESS_MALL_FULFILLED'
  AND NOT EXISTS (
    SELECT 1 FROM `notification_templates`
    WHERE code = 'BUSINESS_MALL_FULFILLED_INAPP' AND channel = 'in_app'
  );


SET FOREIGN_KEY_CHECKS = 1;


-- ============================================================================
-- §9  部署后验证（仅 SELECT，可重复执行）
--     期望值：
--       tasks_count          = 17
--       mall_items_count     = 7
--       permissions_count    = 11
--       permissions_type_4   = 11   (全部正确为 API 类型)
--       notif_types_count    = 6
--       notif_templates_count= 7
--       system_configs_count = 10
--       member_levels_with_v2_benefits = 5  (free/silver/gold/diamond/black 全部已写入 v2 扩展键)
-- ============================================================================
SELECT 'tasks_count'                  AS metric, COUNT(*) AS value FROM `tasks`
UNION ALL SELECT 'mall_items_count',           COUNT(*) FROM `points_mall_items`
UNION ALL SELECT 'permissions_count',          COUNT(*) FROM `permissions` WHERE `module`='points'
UNION ALL SELECT 'permissions_type_4',         COUNT(*) FROM `permissions` WHERE `module`='points' AND `type`=4
UNION ALL SELECT 'notif_types_count',          COUNT(*) FROM `notification_types`
   WHERE `deleted_at` IS NULL
     AND `code` IN ('BUSINESS_POINTS_EARNED','BUSINESS_POINTS_EXPIRE_REMIND','BUSINESS_POINTS_EXPIRED',
                    'BUSINESS_TASK_COMPLETED','BUSINESS_LEVEL_UP','BUSINESS_MALL_FULFILLED')
UNION ALL SELECT 'notif_templates_count',      COUNT(*) FROM `notification_templates`
   WHERE `deleted_at` IS NULL
     AND (`code` LIKE 'BUSINESS_POINTS%' OR `code` LIKE 'BUSINESS_TASK%'
       OR `code` IN ('BUSINESS_LEVEL_UP_INAPP','BUSINESS_MALL_FULFILLED_INAPP'))
UNION ALL SELECT 'system_configs_count',       COUNT(*) FROM `system_configs` WHERE `group`='points'
UNION ALL SELECT 'member_levels_with_v2_benefits', COUNT(*) FROM `member_levels`
   WHERE JSON_EXTRACT(`benefits`, '$.points_multiplier') IS NOT NULL;

-- §9.1 索引创建状态确认（核心 5 个索引）
SELECT
  TABLE_NAME, INDEX_NAME, COLUMN_NAME, SEQ_IN_INDEX
FROM information_schema.STATISTICS
WHERE TABLE_SCHEMA = DATABASE()
  AND (
    (TABLE_NAME = 'points_logs' AND INDEX_NAME IN ('idx_user_status_expire','idx_status_expire')) OR
    (TABLE_NAME = 'user_tasks'  AND INDEX_NAME = 'uk_user_task_cycle') OR
    (TABLE_NAME = 'user_signs'  AND INDEX_NAME = 'uk_user_date') OR
    (TABLE_NAME = 'points_expiry_notices' AND INDEX_NAME = 'uk_user_stage_expire')
  )
ORDER BY TABLE_NAME, INDEX_NAME, SEQ_IN_INDEX;

-- ============================================================================
-- 部署完成。
-- 后续步骤：
--   1. 重启应用：pm2 restart all 或 npm run dev
--   2. 跑历史用户迁移（仅生产首次部署）：NODE_ENV=production npx ts-node scripts/migrate_existing_users_points.ts
--   3. 健康检查：GET /api/sign/status / GET /api/tasks / GET /api/points-mall/items
-- ============================================================================
