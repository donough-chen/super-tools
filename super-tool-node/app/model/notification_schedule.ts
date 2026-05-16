import { Application } from 'egg';

export default (app: Application) => {
  const { BIGINT, STRING, TINYINT, JSON: JSON_TYPE, DATE, TEXT, ENUM } = app.Sequelize;
  return app.model.define('NotificationSchedule', {
    id:           { type: BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
    code:         { type: STRING(100), allowNull: false, unique: true },
    name:         { type: STRING(200), allowNull: false },
    handler:      { type: STRING(100), allowNull: false },
    cronExpr:     { type: STRING(100), allowNull: false, field: 'cron_expr' },
    enabled:      { type: TINYINT, allowNull: false, defaultValue: 1 },
    params:       { type: JSON_TYPE, allowNull: true },
    lastFireAt:   { type: DATE, allowNull: true, field: 'last_fire_at' },
    lastStatus:   { type: ENUM('success', 'failed'), allowNull: true, field: 'last_status' },
    lastMessage:  { type: TEXT, allowNull: true, field: 'last_message' },
    nextFireAt:   { type: DATE, allowNull: true, field: 'next_fire_at' },
    createdAt:    { type: DATE, field: 'created_at' },
    updatedAt:    { type: DATE, field: 'updated_at' },
  }, {
    tableName: 'notification_schedules',
    underscored: true,
    timestamps: true,
  });
};
