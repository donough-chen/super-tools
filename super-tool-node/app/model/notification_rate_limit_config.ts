/**
 * @file 频控配置模型 (notification_rate_limit_config)
 * @description 配置用户/渠道/类型三维度的发送频率限制规则。
 *   scope: global_user(全局用户级) | channel(渠道级) | type(类型级)
 *   window: hour | day | week
 *   规则缓存 5 分钟，修改后清除 Redis 缓存立即生效。
 */
import { Application } from 'egg';
import { DataTypes } from 'sequelize';

export default (app: Application) => {
  const { BIGINT, STRING, TINYINT, INTEGER } = DataTypes;
  const NotificationRateLimitConfig = app.model.define('NotificationRateLimitConfig', {
    id:               { type: BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
    scope:            { type: STRING(20), allowNull: false },
    targetKey:        { type: STRING(64), allowNull: true, field: 'target_key' },
    window:           { type: STRING(20), allowNull: false },
    maxCount:         { type: INTEGER, allowNull: false, field: 'max_count' },
    skipPriority:     { type: TINYINT, allowNull: true, field: 'skip_priority' },
    enabled:          { type: TINYINT, allowNull: false, defaultValue: 1 },
    description:      { type: STRING(200), allowNull: true },
    updatedBy:        { type: BIGINT.UNSIGNED, allowNull: true, field: 'updated_by' },
  }, {
    tableName: 'notification_rate_limit_config',
    timestamps: true,
    underscored: true,
  });

  return NotificationRateLimitConfig;
};
