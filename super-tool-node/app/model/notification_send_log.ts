/**
 * @file 渠道下发日志模型 (notification_send_logs) — 核心大表
 * @description 记录每个渠道的实际下发动作审计日志，预计千万级数据量。
 *   一条 message 发到 3 个渠道 = 3 条 send_logs。
 *   记录完整的发送生命周期：queued → sending → sent → delivered | failed | skipped
 *   支持重试记录(attempt)、耗时统计(cost_ms)、服务商原始响应。
 *   保留策略：默认 90 天，由 cleanupSendLogs schedule 自动清理。
 */
import { Application } from 'egg';
import { DataTypes } from 'sequelize';

export default (app: Application) => {
  const { BIGINT, STRING, TEXT, TINYINT, INTEGER, DATE, JSON: JSON_TYPE } = DataTypes;
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
    extra:            { type: JSON_TYPE, allowNull: true },
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
