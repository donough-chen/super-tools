-- Rollback 020
ALTER TABLE notification_tasks
  DROP COLUMN IF EXISTS last_fire_at,
  DROP COLUMN IF EXISTS next_fire_at,
  DROP COLUMN IF EXISTS canceled_at,
  DROP COLUMN IF EXISTS paused_at,
  DROP COLUMN IF EXISTS undo_window_sec,
  DROP COLUMN IF EXISTS rrule;
