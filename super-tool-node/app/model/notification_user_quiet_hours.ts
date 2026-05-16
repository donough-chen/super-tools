import { Application } from 'egg';
import { DataTypes } from 'sequelize';

export default (app: Application) => {
  const { BIGINT, STRING, TINYINT, TIME } = DataTypes;
  const NotificationUserQuietHours = app.model.define('NotificationUserQuietHours', {
    userId:           { type: BIGINT.UNSIGNED, primaryKey: true, field: 'user_id' },
    enabled:          { type: TINYINT, allowNull: false, defaultValue: 0 },
    quietStart:       { type: TIME, allowNull: true, field: 'quiet_start' },
    quietEnd:         { type: TIME, allowNull: true, field: 'quiet_end' },
    timezone:         { type: STRING(40), allowNull: false, defaultValue: 'Asia/Shanghai' },
    receiveUrgent:    { type: TINYINT, allowNull: false, defaultValue: 1, field: 'receive_urgent' },
  }, {
    tableName: 'notification_user_quiet_hours',
    timestamps: true,
    createdAt: false,
    underscored: true,
  });

  return NotificationUserQuietHours;
};
