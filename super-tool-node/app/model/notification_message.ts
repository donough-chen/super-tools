/**
 * @file 用户消息记录模型 (notification_messages) — 核心大表
 * @description 存储用户视角的站内信消息实例，预计千万级数据量。
 *   一条任务发送给 N 个用户 = N 条 messages 记录。
 *   记录已读/归档状态，支持幂等键防重复。
 *   关联：belongsTo NotificationType, belongsTo NotificationTask
 *   无 updatedAt（只增不改，标记已读通过单独字段）
 */
import { Application } from 'egg';
import { DataTypes } from 'sequelize';

export default (app: Application) => {
  const { BIGINT, STRING, TEXT, TINYINT, INTEGER, DATE, JSON: JSON_TYPE } = DataTypes;
  const NotificationMessage = app.model.define('NotificationMessage', {
    id:               { type: BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
    taskId:           { type: BIGINT.UNSIGNED, allowNull: true, field: 'task_id' },
    typeId:           { type: BIGINT.UNSIGNED, allowNull: false, field: 'type_id' },
    templateId:       { type: BIGINT.UNSIGNED, allowNull: true, field: 'template_id' },
    templateVersion:  { type: INTEGER, allowNull: true, field: 'template_version' },
    userId:           { type: BIGINT.UNSIGNED, allowNull: false, field: 'user_id' },
    title:            { type: STRING(200), allowNull: true },
    content:          { type: TEXT, allowNull: false },
    summary:          { type: STRING(500), allowNull: true },
    extra:            { type: JSON_TYPE, allowNull: true },
    channels:         { type: JSON_TYPE, allowNull: false },
    priority:         { type: TINYINT, allowNull: false, defaultValue: 2 },
    isRead:           { type: TINYINT, allowNull: false, defaultValue: 0, field: 'is_read' },
    readAt:           { type: DATE, allowNull: true, field: 'read_at' },
    isArchived:       { type: TINYINT, allowNull: false, defaultValue: 0, field: 'is_archived' },
    archivedAt:       { type: DATE, allowNull: true, field: 'archived_at' },
    expireAt:         { type: DATE, allowNull: true, field: 'expire_at' },
    idempotentKey:    { type: STRING(128), allowNull: true, field: 'idempotent_key' },
  }, {
    tableName: 'notification_messages',
    timestamps: true,
    updatedAt: false,
    underscored: true,
  });

  (NotificationMessage as any).associate = () => {
    NotificationMessage.belongsTo(app.model.NotificationType, { foreignKey: 'type_id', as: 'type' });
    NotificationMessage.belongsTo(app.model.NotificationTask, { foreignKey: 'task_id', as: 'task' });
  };

  return NotificationMessage;
};
