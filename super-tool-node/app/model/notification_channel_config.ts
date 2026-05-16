import { Application } from 'egg';
import { DataTypes } from 'sequelize';

export default (app: Application) => {
  const { BIGINT, STRING, TINYINT, DECIMAL, DATE, JSON: JSON_TYPE } = DataTypes;
  const NotificationChannelConfig = app.model.define('NotificationChannelConfig', {
    id:               { type: BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
    channel:          { type: STRING(20), allowNull: false },
    provider:         { type: STRING(40), allowNull: false },
    isDefault:        { type: TINYINT, allowNull: false, defaultValue: 0, field: 'is_default' },
    config:           { type: JSON_TYPE, allowNull: false },
    enabled:          { type: TINYINT, allowNull: false, defaultValue: 1 },
    healthStatus:     { type: STRING(20), allowNull: false, defaultValue: 'unknown', field: 'health_status' },
    lastCheckAt:      { type: DATE, allowNull: true, field: 'last_check_at' },
    lastSuccessRate:  { type: DECIMAL(5, 2), allowNull: true, field: 'last_success_rate' },
    description:      { type: STRING(200), allowNull: true },
  }, {
    tableName: 'notification_channel_configs',
    timestamps: true,
    underscored: true,
  });

  return NotificationChannelConfig;
};
