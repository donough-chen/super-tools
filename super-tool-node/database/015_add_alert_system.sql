-- ============================================================
-- Phase 3: 智能化预警和提醒
-- ============================================================

CREATE TABLE IF NOT EXISTS alert_rules (
  id INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(100) NOT NULL COMMENT '规则名称',
  description VARCHAR(500) COMMENT '规则描述',
  metric_type ENUM('user_count','active_user','new_user','tool_usage',
    'error_rate','response_time','feedback_pending','member_expire',
    'session_count') NOT NULL COMMENT '监控指标类型',
  condition_type ENUM('gt','lt','gte','lte','change_rate_up','change_rate_down')
    NOT NULL COMMENT '条件类型',
  threshold DECIMAL(10,2) NOT NULL COMMENT '阈值',
  time_window INT UNSIGNED DEFAULT 60 COMMENT '检测时间窗口(分钟)',
  compare_window INT UNSIGNED DEFAULT 1440 COMMENT '环比对比窗口(分钟)',
  severity ENUM('info','warning','critical') DEFAULT 'warning' COMMENT '严重级别',
  notify_channels JSON COMMENT '通知渠道',
  notify_role_ids JSON COMMENT '通知角色ID',
  is_enabled TINYINT(1) DEFAULT 1 COMMENT '是否启用',
  cooldown_minutes INT UNSIGNED DEFAULT 30 COMMENT '冷却时间(分钟)',
  last_triggered_at DATETIME COMMENT '上次触发时间',
  created_by INT UNSIGNED COMMENT '创建者',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_enabled_metric (is_enabled, metric_type),
  INDEX idx_created_by (created_by)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='告警规则';

CREATE TABLE IF NOT EXISTS alert_logs (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  rule_id INT UNSIGNED NOT NULL COMMENT '规则ID',
  rule_name VARCHAR(100) NOT NULL COMMENT '规则名称',
  metric_type VARCHAR(50) NOT NULL COMMENT '指标类型',
  metric_value DECIMAL(10,2) COMMENT '触发时指标值',
  threshold_value DECIMAL(10,2) COMMENT '阈值',
  condition_desc VARCHAR(200) COMMENT '条件描述',
  severity ENUM('info','warning','critical') NOT NULL,
  status ENUM('firing','acknowledged','resolved') DEFAULT 'firing',
  acknowledged_by INT UNSIGNED,
  acknowledged_at DATETIME,
  resolved_at DATETIME,
  resolve_note VARCHAR(500),
  details JSON COMMENT '详细上下文',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_rule_status (rule_id, status),
  INDEX idx_severity_status (severity, status),
  INDEX idx_created_at (created_at),
  FOREIGN KEY (rule_id) REFERENCES alert_rules(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='告警记录';

-- 预置告警规则
INSERT INTO alert_rules (name, description, metric_type, condition_type, threshold, time_window, severity, notify_channels, cooldown_minutes) VALUES
('API错误率飙升', 'API错误率超过5%时告警', 'error_rate', 'gt', 5.00, 5, 'critical', '["websocket","notification"]', 15),
('新用户骤降', '新增用户环比下降超过50%', 'new_user', 'change_rate_down', 50.00, 1440, 'warning', '["websocket","notification"]', 60),
('反馈积压预警', '待处理反馈超过50条', 'feedback_pending', 'gt', 50.00, 60, 'warning', '["websocket","notification"]', 120),
('活跃用户异常下降', 'DAU环比下降超过30%', 'active_user', 'change_rate_down', 30.00, 1440, 'critical', '["websocket","notification"]', 60),
('会员批量到期', '7天内到期会员超过100人', 'member_expire', 'gt', 100.00, 10080, 'info', '["notification"]', 1440),
('API响应变慢', '平均响应时间超过3秒', 'response_time', 'gt', 3000.00, 5, 'warning', '["websocket","notification"]', 30),
('在线会话异常', '活跃会话数超过10000', 'session_count', 'gt', 10000.00, 5, 'warning', '["websocket"]', 30);
