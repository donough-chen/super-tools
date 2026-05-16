import { Application } from 'egg';
import { DataTypes } from 'sequelize';

export default (app: Application) => {
  const { BIGINT, STRING, TEXT, TINYINT, INTEGER, DATE } = DataTypes;
  const NotificationSendLog = app.model.define('NotificationSendLog', {
    id:               { type: BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
    messageId:        { type: BIGINT.UNSIGNED, allowNull: true, field: 'message_id' },
    taskId:           { type: BIGINT.UNSIGNED, allowNull: true, field: 'task_id' },
    userId:           { type: BIGINT.UNSIGNED, allowNull: false, field: 'user_id' },
    channel:          { type: STRING(20), allowNull: false },
    provider:         { type: STRING(40), allowNull: true },
    status:           { type: STRING(20), allowNull: false },
    skipReason:       { type: STRING(40), allowNull: true, field: 'skip_reason' },
    attempt:          { type: TINYINT, allowNull: false, defaultValue: 1 },
    target:           { type: STRING(200), allowNull: true },
    requestId:        { type: STRING(128), allowNull: true, field: 'request_id' },
    errorCode:        { type: STRING(64), allowNull: true, field: 'error_code' },
    errorMessage:     { type: STRING(500), allowNull: true, field: 'error_message' },
    rawResponse:      { type: TEXT, allowNull: true, field: 'raw_response' },
    costMs:           { type: INTEGER, allowNull: true, field: 'cost_ms' },
    sentAt:           { type: DATE, allowNull: true, field: 'sent_at' },
    deliveredAt:      { type: DATE, allowNull: true, field: 'delivered_at' },
  }, {
    tableName: 'notification_send_logs',
    timestamps: true,
    updatedAt: false,
    underscored: true,
  });

  return NotificationSendLog;
};
