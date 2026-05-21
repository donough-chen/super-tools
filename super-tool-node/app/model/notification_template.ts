/**
 * @file 通知模板模型 (notification_templates)
 * @description 存储各渠道的消息模板，支持 Mustache 变量语法和版本管理。
 *   (code, channel) 联合唯一标识一个模板。
 *   状态：0=草稿, 1=已发布, 2=已停用
 *   关联：belongsTo NotificationType, hasMany NotificationTemplateVersion
 *   软删除：paranoid=true
 */
import { Application } from 'egg';
import { DataTypes } from 'sequelize';

export default (app: Application) => {
  const { BIGINT, STRING, TEXT, TINYINT, INTEGER, DATE, JSON: JSON_TYPE } = DataTypes;
  const NotificationTemplate = app.model.define('NotificationTemplate', {
    id:               { type: BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
    typeId:           { type: BIGINT.UNSIGNED, allowNull: false, field: 'type_id' },
    code:             { type: STRING(64), allowNull: false },
    name:             { type: STRING(100), allowNull: false },
    channel:          { type: STRING(20), allowNull: false },
    titleTemplate:    { type: STRING(200), allowNull: true, field: 'title_template' },
    contentTemplate:  { type: TEXT, allowNull: false, field: 'content_template' },
    extraConfig:      { type: JSON_TYPE, allowNull: true, field: 'extra_config' },
    sampleVariables:  { type: JSON_TYPE, allowNull: true, field: 'sample_variables' },
    currentVersion:   { type: INTEGER, allowNull: false, defaultValue: 1, field: 'current_version' },
    status:           { type: TINYINT, allowNull: false, defaultValue: 0 },
    description:      { type: STRING(500), allowNull: true },
    createdBy:        { type: BIGINT.UNSIGNED, allowNull: false, field: 'created_by' },
    updatedBy:        { type: BIGINT.UNSIGNED, allowNull: true, field: 'updated_by' },
    deletedAt:        { type: DATE, allowNull: true, field: 'deleted_at' },
  }, {
    tableName: 'notification_templates',
    timestamps: true,
    paranoid: true,
    underscored: true,
  });

  (NotificationTemplate as any).associate = () => {
    NotificationTemplate.belongsTo(app.model.NotificationType, { foreignKey: 'type_id', as: 'type' });
    NotificationTemplate.hasMany(app.model.NotificationTemplateVersion, { foreignKey: 'template_id', as: 'versions' });
  };

  return NotificationTemplate;
};
