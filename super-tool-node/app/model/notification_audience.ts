/**
 * @file 受众分组模型 (notification_audiences)
 * @description 定义通知目标用户群体，支持全量/静态/动态三种圈选模式。
 *   动态规则存储为 JSON，由 audienceRuleCompiler 编译为 SQL 执行。
 *   软删除：paranoid=true
 */
import { Application } from 'egg';
import { DataTypes } from 'sequelize';

export default (app: Application) => {
  const { BIGINT, STRING, DATE, JSON: JSON_TYPE } = DataTypes;
  const NotificationAudience = app.model.define('NotificationAudience', {
    id:               { type: BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
    name:             { type: STRING(100), allowNull: false },
    code:             { type: STRING(64), allowNull: true },
    description:      { type: STRING(500), allowNull: true },
    audienceType:     { type: STRING(20), allowNull: false, field: 'audience_type' },
    staticUserIds:    { type: JSON_TYPE, allowNull: true, field: 'static_user_ids' },
    dynamicRules:     { type: JSON_TYPE, allowNull: true, field: 'dynamic_rules' },
    cachedCount:      { type: BIGINT, allowNull: true, field: 'cached_count' },
    cachedAt:         { type: DATE, allowNull: true, field: 'cached_at' },
    createdBy:        { type: BIGINT.UNSIGNED, allowNull: false, field: 'created_by' },
    deletedAt:        { type: DATE, allowNull: true, field: 'deleted_at' },
  }, {
    tableName: 'notification_audiences',
    timestamps: true,
    paranoid: true,
    underscored: true,
  });

  return NotificationAudience;
};
