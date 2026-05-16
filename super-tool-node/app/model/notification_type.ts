import { Application } from 'egg';
import { DataTypes } from 'sequelize';

export default (app: Application) => {
  const { BIGINT, STRING, TINYINT, INTEGER, DATE, JSON: JSON_TYPE } = DataTypes;
  const NotificationType = app.model.define('NotificationType', {
    id:               { type: BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
    parentId:         { type: BIGINT.UNSIGNED, allowNull: true, field: 'parent_id' },
    code:             { type: STRING(64), allowNull: false },
    name:             { type: STRING(100), allowNull: false },
    description:      { type: STRING(500), allowNull: true },
    category:         { type: STRING(20), allowNull: false },
    defaultChannels:  { type: JSON_TYPE, allowNull: false, field: 'default_channels' },
    userCancelable:   { type: TINYINT, allowNull: false, defaultValue: 1, field: 'user_cancelable' },
    priority:         { type: TINYINT, allowNull: false, defaultValue: 2 },
    icon:             { type: STRING(64), allowNull: true },
    color:            { type: STRING(16), allowNull: true },
    status:           { type: TINYINT, allowNull: false, defaultValue: 1 },
    sortOrder:        { type: INTEGER, allowNull: false, defaultValue: 0, field: 'sort_order' },
    isSystem:         { type: TINYINT, allowNull: false, defaultValue: 0, field: 'is_system' },
    deletedAt:        { type: DATE, allowNull: true, field: 'deleted_at' },
  }, {
    tableName: 'notification_types',
    timestamps: true,
    paranoid: true,
    underscored: true,
  });

  (NotificationType as any).associate = () => {
    NotificationType.hasMany(app.model.NotificationTemplate, { foreignKey: 'type_id', as: 'templates' });
  };

  return NotificationType;
};
