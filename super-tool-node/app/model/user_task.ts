import { Application } from 'egg';
import { DataTypes } from 'sequelize';

export interface UserTaskAttributes {
  id: number;
  userId: number;
  taskCode: string;
  cycleKey: string;
  progress: number;
  progressMeta?: any;
  status: 'pending' | 'completed' | 'claimed' | 'expired';
  expireAt?: Date;
  completedAt?: Date;
  claimedAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

export default (app: Application) => {
  const { STRING, INTEGER, BIGINT, DATE, JSON: JSON_TYPE, ENUM } = DataTypes;

  const UserTask = app.model.define('UserTask', {
    id: { type: BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
    userId: { type: BIGINT.UNSIGNED, allowNull: false, field: 'user_id' },
    taskCode: { type: STRING(50), allowNull: false, field: 'task_code' },
    cycleKey: { type: STRING(20), allowNull: false, field: 'cycle_key' },
    progress: { type: INTEGER.UNSIGNED, defaultValue: 0 },
    progressMeta: { type: JSON_TYPE, allowNull: true, field: 'progress_meta' },
    status: { type: ENUM('pending', 'completed', 'claimed', 'expired'), defaultValue: 'pending' },
    expireAt: { type: DATE, allowNull: true, field: 'expire_at' },
    completedAt: { type: DATE, allowNull: true, field: 'completed_at' },
    claimedAt: { type: DATE, allowNull: true, field: 'claimed_at' },
  }, {
    tableName: 'user_tasks',
    timestamps: true,
    underscored: true,
  });

  (UserTask as any).associate = () => {
    // 注意：task_code 是字符串外键，使用 sourceKey/targetKey 映射 attribute name
    UserTask.belongsTo(app.model.Task, {
      foreignKey: 'taskCode',
      targetKey: 'code',
      as: 'task',
    });
  };

  return UserTask;
};
