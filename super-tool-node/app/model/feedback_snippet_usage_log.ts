/**
 * @file 反馈话术使用记录模型 (feedback_snippet_usage_logs)
 * @description 每次使用话术回复反馈时插入一条；timestamps:false（只有 created_at）
 *   feedback_status_after 用于满意度代理指标（关闭率），随反馈状态变化异步更新
 */
import { Application } from 'egg';
import { DataTypes } from 'sequelize';

export interface FeedbackSnippetUsageLogAttributes {
  id: number;
  snippetId: number;
  feedbackId: number;
  userId: number;
  finalContent: string | null;
  feedbackStatusAfter: number | null;  // 2 已回复 / 3 已关闭
  createdAt: Date;
}

export default (app: Application) => {
  const { BIGINT, TEXT, TINYINT, DATE, NOW } = DataTypes;
  const FeedbackSnippetUsageLog = app.model.define('FeedbackSnippetUsageLog', {
    id:                  { type: BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
    snippetId:           { type: BIGINT.UNSIGNED, allowNull: false, field: 'snippet_id' },
    feedbackId:          { type: BIGINT.UNSIGNED, allowNull: false, field: 'feedback_id' },
    userId:              { type: BIGINT.UNSIGNED, allowNull: false, field: 'user_id' },
    finalContent:        { type: TEXT,    allowNull: true,  field: 'final_content' },
    feedbackStatusAfter: { type: TINYINT, allowNull: true,  field: 'feedback_status_after' },
    createdAt:           { type: DATE,    allowNull: false, defaultValue: NOW, field: 'created_at' },
  }, {
    tableName: 'feedback_snippet_usage_logs',
    timestamps: false,
    underscored: true,
  });

  (FeedbackSnippetUsageLog as any).associate = () => {
    FeedbackSnippetUsageLog.belongsTo(
      (app.model as any).FeedbackSnippet,
      { foreignKey: 'snippet_id', as: 'snippet' },
    );
  };

  return FeedbackSnippetUsageLog;
};
