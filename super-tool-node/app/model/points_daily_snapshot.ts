import { Application } from 'egg';
import { DataTypes } from 'sequelize';

export interface PointsDailySnapshotAttributes {
  id: number;
  snapshotDate: string;
  userId: number;
  pointsBalance: number;
  theoreticalBalance: number;
  diff: number;
  growthValue: number;
  levelId: number;
  isAnomaly: number;
  createdAt?: Date;
}

export default (app: Application) => {
  const { INTEGER, BIGINT, DATEONLY, TINYINT } = DataTypes;

  return app.model.define('PointsDailySnapshot', {
    id: { type: BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
    snapshotDate: { type: DATEONLY, allowNull: false, field: 'snapshot_date' },
    userId: { type: BIGINT.UNSIGNED, allowNull: false, field: 'user_id' },
    pointsBalance: { type: INTEGER.UNSIGNED, defaultValue: 0, field: 'points_balance' },
    theoreticalBalance: { type: BIGINT, defaultValue: 0, field: 'theoretical_balance' },
    diff: { type: BIGINT, defaultValue: 0 },
    growthValue: { type: INTEGER.UNSIGNED, defaultValue: 0, field: 'growth_value' },
    levelId: { type: INTEGER.UNSIGNED, allowNull: false, field: 'level_id' },
    isAnomaly: { type: TINYINT, defaultValue: 0, field: 'is_anomaly' },
  }, {
    tableName: 'points_daily_snapshots',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false,
    underscored: true,
  });
};
