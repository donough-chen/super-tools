import { Application } from 'egg';
import { DataTypes } from 'sequelize';

export interface TaskCompletionLogAttributes {
  id: number;
  userTaskId: number;
  userId: number;
  taskCode: string;
  cycleKey: string;
  rewardPoints: number;
  rewardGrowth: number;
  bonusRate: number;
  status: 'pending' | 'rewarded' | 'failed';
  pointsLogId?: number;
  errorMsg?: string;
  retryCount: number;
  nextRetryAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

export default (app: Application) => {
  const { STRING, INTEGER, BIGINT, DATE, ENUM, DECIMAL } = DataTypes;

  return app.model.define('TaskCompletionLog', {
    id: { type: BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
    userTaskId: { type: BIGINT.UNSIGNED, allowNull: false, field: 'user_task_id', unique: true },
    userId: { type: BIGINT.UNSIGNED, allowNull: false, field: 'user_id' },
    taskCode: { type: STRING(50), allowNull: false, field: 'task_code' },
    cycleKey: { type: STRING(20), allowNull: false, field: 'cycle_key' },
    rewardPoints: { type: INTEGER.UNSIGNED, defaultValue: 0, field: 'reward_points' },
    rewardGrowth: { type: INTEGER.UNSIGNED, defaultValue: 0, field: 'reward_growth' },
    bonusRate: { type: DECIMAL(4, 2), defaultValue: 1.00, field: 'bonus_rate' },
    status: { type: ENUM('pending', 'rewarded', 'failed'), defaultValue: 'pending' },
    pointsLogId: { type: BIGINT.UNSIGNED, allowNull: true, field: 'points_log_id' },
    errorMsg: { type: STRING(500), allowNull: true, field: 'error_msg' },
    retryCount: { type: INTEGER.UNSIGNED, defaultValue: 0, field: 'retry_count' },
    nextRetryAt: { type: DATE, allowNull: true, field: 'next_retry_at' },
  }, {
    tableName: 'task_completion_logs',
    timestamps: true,
    underscored: true,
  });
};
