DELETE FROM `admin_role_permissions`
WHERE permission_id IN (
  SELECT id FROM `admin_permissions`
  WHERE code IN ('notification:stats:view','notification:export:create')
);
DELETE FROM `admin_permissions`
WHERE code IN ('notification:stats:view','notification:export:create');

DELETE FROM `dashboard_widget`
WHERE code IN ('notif_unread_count','notif_send_trend_7d','notif_channel_dist_pie','notif_top_types','notif_queue_depth');

DROP TABLE IF EXISTS `notification_export_jobs`;
