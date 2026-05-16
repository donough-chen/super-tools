import { Application } from 'egg';
import { DataTypes } from 'sequelize';

export default (app: Application) => {
  const { BIGINT, STRING, TINYINT } = DataTypes;
  const NotificationUserPreference = app.model.define('NotificationUserPreference', {
    id:               { type: BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
    userId:           { type: BIGINT.UNSIGNED, allowNull: false, field: 'user_id' },
    typeId:           { type: BIGINT.UNSIGNED, allowNull: false, field: 'type_id' },
    channel:          { type: STRING(20), allowNull: false },
    isSubscribed:     { type: TINYINT(1), allowNull: false, defaultValue: 1, field: 'is_subscribed' },
  }, {
    tableName: 'notification_user_preferences',
    timestamps: true,
    createdAt: false,
    underscored: true,
  });

  return NotificationUserPreference;
};
