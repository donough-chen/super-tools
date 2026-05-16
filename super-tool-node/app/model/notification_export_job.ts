import { Application } from 'egg';

export default (app: Application) => {
  const { BIGINT, STRING, INTEGER, ENUM, JSON: JSONType, DATE, TEXT } = app.Sequelize;
  return app.model.define('NotificationExportJob', {
    id:             { type: BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
    name:           { type: STRING(200), allowNull: false },
    filter:         { type: JSONType, allowNull: false },
    status:         { type: ENUM('pending', 'running', 'completed', 'failed', 'expired'),
                      allowNull: false, defaultValue: 'pending' },
    totalRows:      { type: INTEGER.UNSIGNED, allowNull: true, field: 'total_rows' },
    filePath:       { type: STRING(500), allowNull: true, field: 'file_path' },
    fileSize:       { type: BIGINT.UNSIGNED, allowNull: true, field: 'file_size' },
    recipientEmail: { type: STRING(200), allowNull: true, field: 'recipient_email' },
    errorMessage:   { type: TEXT, allowNull: true, field: 'error_message' },
    createdBy:      { type: BIGINT.UNSIGNED, allowNull: false, field: 'created_by' },
    startedAt:      { type: DATE, allowNull: true, field: 'started_at' },
    finishedAt:     { type: DATE, allowNull: true, field: 'finished_at' },
    expiresAt:      { type: DATE, allowNull: true, field: 'expires_at' },
    createdAt:      { type: DATE, field: 'created_at' },
    updatedAt:      { type: DATE, field: 'updated_at' },
  }, {
    tableName: 'notification_export_jobs',
    underscored: true,
    timestamps: true,
  });
};
