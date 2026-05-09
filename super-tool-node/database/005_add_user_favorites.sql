-- ============================================================
-- 迁移脚本: 005_add_user_favorites.sql
-- 版本: 2.4.0
-- 创建时间: 2026-05-08
-- 说明: 新增「用户收藏工具」模块
-- 设计文档: docs/superpowers/specs/2026-05-08-用户收藏工具模块设计文档.md
-- ============================================================

USE `superadmin_db`;

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;


-- ------------------------------------------------------------
-- 1. 用户收藏工具表
-- ------------------------------------------------------------
-- 设计要点：
--   1) (user_id, tool_id) 联合唯一，保证同一用户对同一工具至多收藏一次
--   2) sort 用于「手动拖拽排序」，数值越小越靠前，新收藏默认最大 sort+10
--   3) favorited_at 记录收藏时间，作为 sort 相同时的兜底排序键
--   4) 工具被删除时联动清理收藏记录（ON DELETE CASCADE）
--   5) 用户被删除时联动清理收藏记录（ON DELETE CASCADE）
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS `user_tool_favorites` (
  `id`            BIGINT UNSIGNED  NOT NULL AUTO_INCREMENT                 COMMENT '主键',
  `user_id`       BIGINT UNSIGNED  NOT NULL                                COMMENT '用户ID',
  `tool_id`       BIGINT UNSIGNED  NOT NULL                                COMMENT '工具ID',
  `tool_code`     VARCHAR(60)      NOT NULL                                COMMENT '工具编码（冗余，便于查询）',
  `sort`          INT              NOT NULL DEFAULT 0                      COMMENT '手动排序（越小越前）',
  `favorited_at`  DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP      COMMENT '收藏时间',
  `created_at`    DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP      COMMENT '创建时间',
  `updated_at`    DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_user_tool`         (`user_id`, `tool_id`),
  INDEX       `idx_user_sort`       (`user_id`, `sort`, `id`),
  INDEX       `idx_user_favorited`  (`user_id`, `favorited_at`),
  INDEX       `idx_tool`            (`tool_id`),
  INDEX       `idx_tool_code`       (`tool_code`),
  CONSTRAINT `fk_favorite_user` FOREIGN KEY (`user_id`)
    REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_favorite_tool` FOREIGN KEY (`tool_id`)
    REFERENCES `tools` (`id`)  ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='用户收藏工具表';


SET FOREIGN_KEY_CHECKS = 1;
