-- ============================================================
-- Phase 4: 数据可视化配置 - 仪表板布局
-- ============================================================

CREATE TABLE IF NOT EXISTS dashboard_layouts (
  id INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  user_id INT UNSIGNED COMMENT '所属用户(NULL=系统默认)',
  name VARCHAR(100) NOT NULL COMMENT '布局名称',
  description VARCHAR(500) COMMENT '描述',
  is_default TINYINT(1) DEFAULT 0 COMMENT '是否为默认',
  is_shared TINYINT(1) DEFAULT 0 COMMENT '是否分享',
  share_token VARCHAR(64) UNIQUE COMMENT '分享Token',
  layout_config JSON NOT NULL COMMENT '布局配置',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_user (user_id),
  INDEX idx_share (share_token)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='仪表板布局';

CREATE TABLE IF NOT EXISTS dashboard_widgets (
  id INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  layout_id INT UNSIGNED NOT NULL COMMENT '所属布局',
  widget_type VARCHAR(30) NOT NULL COMMENT '组件类型',
  title VARCHAR(100) COMMENT '标题',
  data_config JSON NOT NULL COMMENT '数据配置',
  style_config JSON COMMENT '样式配置',
  position JSON NOT NULL COMMENT '位置 {x,y,w,h}',
  refresh_interval INT UNSIGNED DEFAULT 0 COMMENT '刷新间隔(秒)',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (layout_id) REFERENCES dashboard_layouts(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='仪表板组件';

-- 系统默认布局
INSERT INTO dashboard_layouts (user_id, name, description, is_default, layout_config) VALUES
(NULL, '系统默认看板', '包含核心KPI和常用图表的默认布局', 1, '{"cols":12,"rowHeight":80,"margin":[16,16]}');
