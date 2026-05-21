/**
 * @file 渠道服务商配置模型 (notification_channel_configs)
 * @description 配置各发送渠道的服务商参数（SMTP/短信SDK/站内信）。
 *   同一渠道可配置多个服务商实现主备切换，config 字段中敏感信息 AES 加密。
 *   支持健康检查状态和成功率监控。
 */
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
