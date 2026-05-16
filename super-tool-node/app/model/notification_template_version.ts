import { Application } from 'egg';
import { DataTypes } from 'sequelize';

export default (app: Application) => {
  const { BIGINT, STRING, TEXT, INTEGER, JSON: JSON_TYPE } = DataTypes;
  const NotificationTemplateVersion = app.model.define('NotificationTemplateVersion', {
    id:               { type: BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
    templateId:       { type: BIGINT.UNSIGNED, allowNull: false, field: 'template_id' },
    version:          { type: INTEGER, allowNull: false },
    titleTemplate:    { type: STRING(200), allowNull: true, field: 'title_template' },
    contentTemplate:  { type: TEXT, allowNull: false, field: 'content_template' },
    extraConfig:      { type: JSON_TYPE, allowNull: true, field: 'extra_config' },
    changeNote:       { type: STRING(500), allowNull: true, field: 'change_note' },
    publishedBy:      { type: BIGINT.UNSIGNED, allowNull: false, field: 'published_by' },
  }, {
    tableName: 'notification_template_versions',
    timestamps: true,
    createdAt: 'published_at',
    updatedAt: false,
    underscored: true,
  });

  return NotificationTemplateVersion;
};
