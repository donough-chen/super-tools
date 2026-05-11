import { Application } from 'egg';
import { DataTypes } from 'sequelize';

export interface FeedbackAttributes {
  id: number;
  userId: number | null;
  type: 'bug' | 'suggestion' | 'praise' | 'other';
  content: string;
  contact: string | null;
  platform: string | null;
  ip: string | null;
  userAgent: string | null;
  status: 0 | 1 | 2 | 3;
  replyContent: string | null;
  replyUserId: number | null;
  repliedAt: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
  deletedAt?: Date | null;
}

export default (app: Application) => {
  const { STRING, TEXT, BIGINT, TINYINT, DATE } = DataTypes;
  const Feedback = app.model.define('Feedback', {
    id:           { type: BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
    userId:       { type: BIGINT.UNSIGNED, allowNull: true,  field: 'user_id' },
    type:         { type: STRING(20), allowNull: false, defaultValue: 'other' },
    content:      { type: TEXT, allowNull: false },
    contact:      { type: STRING(100), allowNull: true },
    platform:     { type: STRING(30), allowNull: true },
    ip:           { type: STRING(50), allowNull: true },
    userAgent:    { type: STRING(500), allowNull: true,  field: 'user_agent' },
    status:       { type: TINYINT.UNSIGNED, allowNull: false, defaultValue: 0 },
    replyContent: { type: TEXT, allowNull: true,  field: 'reply_content' },
    replyUserId:  { type: BIGINT.UNSIGNED, allowNull: true,  field: 'reply_user_id' },
    repliedAt:    { type: DATE, allowNull: true,  field: 'replied_at' },
    deletedAt:    { type: DATE, allowNull: true,  field: 'deleted_at' },
  }, {
    tableName: 'feedbacks',
    timestamps: true,
    underscored: true,
    paranoid: true,    // 自动 deleted_at IS NULL 过滤；destroy() 自动软删
  });

  (Feedback as any).associate = () => {
    Feedback.belongsTo(app.model.User, { foreignKey: 'user_id', as: 'user' });
    Feedback.belongsTo(app.model.User, { foreignKey: 'reply_user_id', as: 'replier' });
  };

  return Feedback;
};
