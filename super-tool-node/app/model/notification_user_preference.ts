/**
 * @file 用户订阅偏好模型 (notification_user_preferences)
 * @description 稀疏存储用户对通知类型×渠道的订阅设置。
 *   无记录=默认订阅；用户取消订阅时才插入 is_subscribed=0 的行。
 *   唯一约束：(user_id, type_id, channel)
 */
import { Application } from 'egg';
import { DataTypes } from 'sequelize';

export default (app: Application) => {
  const { BIGINT, STRING, TINYINT } = DataTypes;
  const NotificationUserPreference = app.model.define('NotificationUserPreference', {
    id:               { type: BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
    userId:           { type: BIGINT.UNSIGNED, allowNull: false, field: 'user_id' },
    typeId:           { type: BIGINT.UNSIGNED, allowNull: false, field: 'type_id' },
    channel:          { type: STRING(20), allowNull: false },
    isSubscribed:     { type: TINYINT, allowNull: false, defaultValue: 1, field: 'is_subscribed' },
  }, {
    tableName: 'notification_user_preferences',
    timestamps: true,
    createdAt: false,
    underscored: true,
  });

  return NotificationUserPreference;
};
