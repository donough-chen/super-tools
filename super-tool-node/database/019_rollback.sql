-- Rollback 019: P2.1
UPDATE notification_types SET quiet_hour_policy = 'respect' WHERE quiet_hour_policy != 'respect';
ALTER TABLE notification_send_logs DROP COLUMN IF EXISTS extra;
ALTER TABLE notification_types DROP COLUMN IF EXISTS quiet_hour_policy;
