import { Application } from 'egg';
import { DataTypes } from 'sequelize';

export interface PointsExpiryLogAttributes {
  id: number;
  userId: number;
  sourceLogId: number;
  expiredPoints: number;
  expiredLogId?: number;
  executedAt?: Date;
}

export default (app: Application) => {
  const { INTEGER, BIGINT, DATE } = DataTypes;

  return app.model.define('PointsExpiryLog', {
    id: { type: BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
    userId: { type: BIGINT.UNSIGNED, allowNull: false, field: 'user_id' },
    sourceLogId: { type: BIGINT.UNSIGNED, allowNull: false, field: 'source_log_id', unique: true },
    expiredPoints: { type: INTEGER.UNSIGNED, allowNull: false, field: 'expired_points' },
    expiredLogId: { type: BIGINT.UNSIGNED, allowNull: true, field: 'expired_log_id' },
    executedAt: { type: DATE, allowNull: false, field: 'executed_at' },
  }, {
    tableName: 'points_expiry_logs',
    timestamps: false,  // executed_at 由 DB 默认 CURRENT_TIMESTAMP 填充
    underscored: true,
  });
};
