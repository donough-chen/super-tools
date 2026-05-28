-- ============================================================================
-- 027 · B1 退款账本契约 — schema 与配置准备
--
-- 设计依据: docs/superpowers/specs/2026-05-27-积分成长体系后端优化设计文档.md §2.7
-- 实施计划: docs/superpowers/plans/2026-05-27-积分成长体系后端优化-B业务修复实施计划.md §B1
-- 上线时间: 2026-05-?? 灰度（5% → 50% → 100%）
--
-- 注意事项:
--   1. 本迁移仅做 schema 与默认配置；service 代码改造在同一 PR 的 TS 部分
--   2. ADD COLUMN points_logs.metadata JSON：MySQL 8.0 INSTANT 算法，秒级
--   3. 灰度回滚通过 system_configs.refund.reverse_fifo=false 即时切换，无需回滚 SQL
--   4. metadata 字段允许为 NULL，旧流水保持不变；新逻辑写入时塞结构化 JSON
--
-- ----------------------------------------------------------------------------
-- 与 Plan/Spec 的偏差修正记录:
--   修正 1: 模型层 (app/model/points_log.ts) 中 balance 仍写 INTEGER.UNSIGNED，
--           与 026 SQL 已 ALTER 为 SIGNED 不一致；model 修正在同 PR 完成
--           （非本 SQL 范围，仅在此记录）
--   修正 2: spec §2.7 应当补充 status=4 (已退款回收) 历史枚举说明：B1 上线后
--           不再写入 status=4，新原批次扣完统一 status=2；存量 status=4 不动
-- ============================================================================

-- ===== 数据校验 SQL（执行前手动跑一次）=====
-- SELECT COUNT(*) AS legacy_status_4 FROM points_logs WHERE status=4;
-- SELECT COUNT(*) AS rows_total      FROM points_logs;
-- SELECT `key`,`value` FROM system_configs WHERE `group`='refund';

START TRANSACTION;

-- =========================================================================
-- §1. schema 变更
-- =========================================================================

-- #1: points_logs.metadata JSON 列（结构化追溯字段）
--   typical payload:
--     {
--       "scenario": "B1_REFUND",
--       "originalLogId": 123,
--       "refundAmount": 80,
--       "recoverHere": 60,
--       "overflow": 20,
--       "fallbackBatchIds": [456, 789]
--     }
SET @col_exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME   = 'points_logs'
    AND COLUMN_NAME  = 'metadata'
);
SET @sql := IF(@col_exists = 0,
  'ALTER TABLE `points_logs` ADD COLUMN `metadata` JSON NULL COMMENT ''扩展信息（B1 退款账本等结构化追溯）'' AFTER `growth_multiplier`',
  'SELECT "points_logs.metadata already exists, skip add"'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- =========================================================================
-- §2. system_configs 默认值（feature flag）
-- =========================================================================

-- #2: refund.reverse_fifo —— B1 新逻辑开关（默认 false，上线后逐步打开）
--     true  = 启用反向 FIFO 退款账本（B1 新逻辑）
--     false = 沿用旧逻辑（仅原批次扣回 + 余下扣会员余额）
INSERT IGNORE INTO `system_configs` (`group`, `key`, `value`, `type`, `is_secret`, `is_public`, `description`)
VALUES
  ('refund', 'reverse_fifo', 'false', 'boolean', 0, 0, 'B1 反向 FIFO 退款账本开关（true=新逻辑/false=旧逻辑）');

COMMIT;

-- ============================================================================
-- ===== 上线后校验 SQL =====
-- ============================================================================
-- SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_COMMENT
--   FROM information_schema.COLUMNS
--  WHERE TABLE_SCHEMA = DATABASE()
--    AND TABLE_NAME = 'points_logs'
--    AND COLUMN_NAME = 'metadata';
-- SELECT `group`,`key`,`value`,`type` FROM system_configs WHERE `group`='refund' AND `key`='reverse_fifo';

-- ============================================================================
-- ===== DOWN SQL（一次性使用，灰度失败时回滚）=====
-- ============================================================================
/*
-- 1) 删 metadata 列（回滚前需确认无业务依赖；新流水将丢失结构化字段）
ALTER TABLE `points_logs` DROP COLUMN `metadata`;

-- 2) 删 feature flag
DELETE FROM `system_configs` WHERE `group`='refund' AND `key`='reverse_fifo';
*/
