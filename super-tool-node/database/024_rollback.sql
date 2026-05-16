DELETE FROM `notification_types` WHERE code IN ('MEMBER_EXPIRE_SOON', 'ALERT_CRITICAL');
DROP TABLE IF EXISTS `notification_schedules`;
