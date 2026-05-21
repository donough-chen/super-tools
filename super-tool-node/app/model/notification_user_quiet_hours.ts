/**
 * @file 用户免打扰配置模型 (notification_user_quiet_hours)
 * @description 记录用户的静默时段设置，支持时区感知和跨午夜时段。
 *   每个用户最多一条记录（user_id 为主键）。
 *   receive_urgent 控制 P0 紧急通知是否豁免静默。
 */
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
