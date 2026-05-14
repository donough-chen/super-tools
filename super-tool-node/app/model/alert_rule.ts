import { Application } from 'egg';
import { DataTypes } from 'sequelize';

export default (app: Application) => {
  const { STRING, TEXT, INTEGER, DECIMAL, TINYINT, DATE, JSON: JSON_TYPE } = DataTypes;
  const AlertRule = app.model.define('AlertRule', {
    id:              { type: INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
    name:            { type: STRING(100), allowNull: false },
    description:     { type: STRING(500), allowNull: true },
    metricType:      { type: STRING(50), allowNull: false, field: 'metric_type' },
    conditionType:   { type: STRING(30), allowNull: false, field: 'condition_type' },
    threshold:       { type: DECIMAL(10, 2), allowNull: false },
    timeWindow:      { type: INTEGER.UNSIGNED, defaultValue: 60, field: 'time_window' },
    compareWindow:   { type: INTEGER.UNSIGNED, defaultValue: 1440, field: 'compare_window' },
    severity:        { type: STRING(20), defaultValue: 'warning' },
    notifyChannels:  { type: JSON_TYPE, allowNull: true, field: 'notify_channels' },
    notifyRoleIds:   { type: JSON_TYPE, allowNull: true, field: 'notify_role_ids' },
    isEnabled:       { type: TINYINT(1), defaultValue: 1, field: 'is_enabled' },
    cooldownMinutes: { type: INTEGER.UNSIGNED, defaultValue: 30, field: 'cooldown_minutes' },
    lastTriggeredAt: { type: DATE, allowNull: true, field: 'last_triggered_at' },
    createdBy:       { type: INTEGER.UNSIGNED, allowNull: true, field: 'created_by' },
  }, {
    tableName: 'alert_rules',
    timestamps: true,
    underscored: true,
  });

  return AlertRule;
};
