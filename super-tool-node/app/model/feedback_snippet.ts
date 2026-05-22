/**
 * @file 反馈话术模型 (feedback_snippets)
 * @description 话术模板，支持 {{var}} 占位符；草稿/发布/停用状态机；paranoid 软删
 *   关联：belongsTo FeedbackSnippetCategory; hasMany FeedbackSnippetVersion; belongsTo User(creator)
 */
import { Application } from 'egg';
import { DataTypes } from 'sequelize';

export type FeedbackSnippetStatus = 0 | 1 | 2; // 0草稿 1已发布 2已停用

export interface FeedbackSnippetAttributes {
  id: number;
  categoryId: number;
  code: string;
  title: string;
  content: string;
  tags: string | null;          // 管道分隔
  sampleVariables: Record<string, any> | null;
  currentVersion: number;
  status: FeedbackSnippetStatus;
  usageCount: number;
  lastUsedAt: Date | null;
  description: string | null;
  createdBy: number;
  updatedBy: number | null;
  createdAt?: Date;
  updatedAt?: Date;
  deletedAt?: Date | null;
}

export default (app: Application) => {
  const { BIGINT, STRING, TEXT, TINYINT, INTEGER, DATE, JSON: JSON_TYPE } = DataTypes;
  const FeedbackSnippet = app.model.define('FeedbackSnippet', {
    id:              { type: BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
    categoryId:      { type: BIGINT.UNSIGNED, allowNull: false, field: 'category_id' },
    code:            { type: STRING(64),  allowNull: false },
    title:           { type: STRING(100), allowNull: false },
    content:         { type: TEXT,        allowNull: false },
    tags:            { type: STRING(255), allowNull: true },
    sampleVariables: { type: JSON_TYPE,   allowNull: true,  field: 'sample_variables' },
    currentVersion:  { type: INTEGER,     allowNull: false, defaultValue: 1, field: 'current_version' },
    status:          { type: TINYINT,     allowNull: false, defaultValue: 0 },
    usageCount:      { type: INTEGER,     allowNull: false, defaultValue: 0, field: 'usage_count' },
    lastUsedAt:      { type: DATE,        allowNull: true,  field: 'last_used_at' },
    description:     { type: STRING(500), allowNull: true },
    createdBy:       { type: BIGINT.UNSIGNED, allowNull: false, field: 'created_by' },
    updatedBy:       { type: BIGINT.UNSIGNED, allowNull: true,  field: 'updated_by' },
    createdAt:       { type: DATE,        allowNull: true,  field: 'created_at' },
    updatedAt:       { type: DATE,        allowNull: true,  field: 'updated_at' },
    deletedAt:       { type: DATE,        allowNull: true,  field: 'deleted_at' },
  }, {
    tableName: 'feedback_snippets',
    timestamps: true,
    paranoid: true,
    underscored: true,
  });

  (FeedbackSnippet as any).associate = () => {
    FeedbackSnippet.belongsTo(
      (app.model as any).FeedbackSnippetCategory,
      { foreignKey: 'category_id', as: 'category' },
    );
    FeedbackSnippet.hasMany(
      (app.model as any).FeedbackSnippetVersion,
      { foreignKey: 'snippet_id', as: 'versions' },
    );
    FeedbackSnippet.belongsTo(app.model.User, {
      foreignKey: 'created_by', as: 'creator', constraints: false,
    });
  };

  return FeedbackSnippet;
};
