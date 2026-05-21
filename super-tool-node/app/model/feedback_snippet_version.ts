/**
 * @file 反馈话术版本快照模型 (feedback_snippet_versions)
 * @description 每次发布生成一条快照，支持版本回滚；timestamps:false (only published_at)
 */
import { Application } from 'egg';
import { DataTypes } from 'sequelize';

export interface FeedbackSnippetVersionAttributes {
  id: number;
  snippetId: number;
  version: number;
  title: string;
  content: string;
  tags: string | null;
  sampleVariables: Record<string, any> | null;
  changeNote: string | null;
  publishedBy: number;
  publishedAt: Date;
}

export default (app: Application) => {
  const { BIGINT, STRING, TEXT, INTEGER, DATE, JSON: JSON_TYPE, NOW } = DataTypes;
  const FeedbackSnippetVersion = app.model.define('FeedbackSnippetVersion', {
    id:              { type: BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
    snippetId:       { type: BIGINT.UNSIGNED, allowNull: false, field: 'snippet_id' },
    version:         { type: INTEGER,     allowNull: false },
    title:           { type: STRING(100), allowNull: false },
    content:         { type: TEXT,        allowNull: false },
    tags:            { type: STRING(255), allowNull: true },
    sampleVariables: { type: JSON_TYPE,   allowNull: true,  field: 'sample_variables' },
    changeNote:      { type: STRING(500), allowNull: true,  field: 'change_note' },
    publishedBy:     { type: BIGINT.UNSIGNED, allowNull: false, field: 'published_by' },
    publishedAt:     { type: DATE,        allowNull: false, defaultValue: NOW, field: 'published_at' },
  }, {
    tableName: 'feedback_snippet_versions',
    timestamps: false,
    underscored: true,
  });

  (FeedbackSnippetVersion as any).associate = () => {
    FeedbackSnippetVersion.belongsTo(
      (app.model as any).FeedbackSnippet,
      { foreignKey: 'snippet_id', as: 'snippet' },
    );
    FeedbackSnippetVersion.belongsTo(app.model.User, {
      foreignKey: 'published_by', as: 'publisher', constraints: false,
    });
  };

  return FeedbackSnippetVersion;
};
