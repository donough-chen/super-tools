/**
 * @file 反馈话术分类模型 (feedback_snippet_categories)
 * @description 树形分类（parent_id），paranoid 软删，预置系统分类不可删（is_system=1）
 *   关联：hasMany FeedbackSnippet
 */
import { Application } from 'egg';
import { DataTypes } from 'sequelize';

export interface FeedbackSnippetCategoryAttributes {
  id: number;
  parentId: number | null;
  code: string;
  name: string;
  description: string | null;
  feedbackType: 'bug' | 'suggestion' | 'praise' | 'other' | null;
  icon: string | null;
  color: string | null;
  sortOrder: number;
  status: 0 | 1;
  isSystem: 0 | 1;
  createdAt?: Date;
  updatedAt?: Date;
  deletedAt?: Date | null;
}

export default (app: Application) => {
  const { BIGINT, STRING, TINYINT, INTEGER, DATE } = DataTypes;
  const FeedbackSnippetCategory = app.model.define('FeedbackSnippetCategory', {
    id:           { type: BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
    parentId:     { type: BIGINT.UNSIGNED, allowNull: true,  field: 'parent_id' },
    code:         { type: STRING(64),  allowNull: false },
    name:         { type: STRING(50),  allowNull: false },
    description:  { type: STRING(255), allowNull: true },
    feedbackType: { type: STRING(20),  allowNull: true,  field: 'feedback_type' },
    icon:         { type: STRING(64),  allowNull: true },
    color:        { type: STRING(16),  allowNull: true },
    sortOrder:    { type: INTEGER,     allowNull: false, defaultValue: 0, field: 'sort_order' },
    status:       { type: TINYINT,     allowNull: false, defaultValue: 1 },
    isSystem:     { type: TINYINT,     allowNull: false, defaultValue: 0, field: 'is_system' },
    deletedAt:    { type: DATE,        allowNull: true,  field: 'deleted_at' },
  }, {
    tableName: 'feedback_snippet_categories',
    timestamps: true,
    paranoid: true,
    underscored: true,
  });

  (FeedbackSnippetCategory as any).associate = () => {
    FeedbackSnippetCategory.hasMany(
      (app.model as any).FeedbackSnippet,
      { foreignKey: 'category_id', as: 'snippets' },
    );
  };

  return FeedbackSnippetCategory;
};
