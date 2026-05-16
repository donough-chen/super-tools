import { Application } from 'egg';
import { DataTypes } from 'sequelize';

export default (app: Application) => {
  const { BIGINT, STRING, TEXT, TINYINT, DATE, JSON: JSON_TYPE } = DataTypes;
  const NotificationTask = app.model.define('NotificationTask', {
    id:               { type: BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
    name:             { type: STRING(200), allowNull: false },
    description:      { type: STRING(500), allowNull: true },
    typeId:           { type: BIGINT.UNSIGNED, allowNull: false, field: 'type_id' },
    templateCode:     { type: STRING(64), allowNull: false, field: 'template_code' },
    channels:         { type: JSON_TYPE, allowNull: false },
    audienceId:       { type: BIGINT.UNSIGNED, allowNull: true, field: 'audience_id' },
    audienceSnapshot: { type: JSON_TYPE, allowNull: true, field: 'audience_snapshot' },
    variables:        { type: JSON_TYPE, allowNull: true },
    scheduleType:     { type: STRING(20), allowNull: false, defaultValue: 'immediate', field: 'schedule_type' },
    scheduledAt:      { type: DATE, allowNull: true, field: 'scheduled_at' },
    cronExpression:   { type: STRING(64), allowNull: true, field: 'cron_expression' },
    priority:         { type: TINYINT, allowNull: false, defaultValue: 2 },
    idempotentKey:    { type: STRING(128), allowNull: true, field: 'idempotent_key' },
    status:           { type: STRING(20), allowNull: false, defaultValue: 'pending' },
    totalCount:       { type: BIGINT, allowNull: false, defaultValue: 0, field: 'total_count' },
    successCount:     { type: BIGINT, allowNull: false, defaultValue: 0, field: 'success_count' },
    failCount:        { type: BIGINT, allowNull: false, defaultValue: 0, field: 'fail_count' },
    skippedCount:     { type: BIGINT, allowNull: false, defaultValue: 0, field: 'skipped_count' },
    startedAt:        { type: DATE, allowNull: true, field: 'started_at' },
    finishedAt:       { type: DATE, allowNull: true, field: 'finished_at' },
    errorMessage:     { type: TEXT, allowNull: true, field: 'error_message' },
    source:           { type: STRING(20), allowNull: false, defaultValue: 'admin' },
    createdBy:        { type: BIGINT.UNSIGNED, allowNull: true, field: 'created_by' },
  }, {
    tableName: 'notification_tasks',
    timestamps: true,
    underscored: true,
  });

  return NotificationTask;
};
