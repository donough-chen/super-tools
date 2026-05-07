import { Application } from 'egg';
import { DataTypes } from 'sequelize';

export interface PointsLogAttributes {
  id: number;
  userId: number;
  type: number;
  source: string;
  points: number;
  balance: number;
  growthDelta: number;
  bizType?: string;
  bizId?: string;
  remark?: string;
  expireAt?: Date;
  createdAt?: Date;
}

export default (app: Application) => {
  const { STRING, INTEGER, BIGINT, TINYINT, DATE } = DataTypes;

  const PointsLog = app.model.define('PointsLog', {
    id: { type: BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
    userId: { type: BIGINT.UNSIGNED, allowNull: false, field: 'user_id' },
    type: { type: TINYINT.UNSIGNED, allowNull: false },
    source: { type: STRING(50), allowNull: false },
    points: { type: INTEGER, allowNull: false },
    balance: { type: INTEGER.UNSIGNED, allowNull: false },
    growthDelta: { type: INTEGER, defaultValue: 0, field: 'growth_delta' },
    bizType: { type: STRING(50), allowNull: true, field: 'biz_type' },
    bizId: { type: STRING(64), allowNull: true, field: 'biz_id' },
    remark: { type: STRING(200), allowNull: true },
    expireAt: { type: DATE, allowNull: true, field: 'expire_at' },
  }, {
    tableName: 'points_logs',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false,
    underscored: true,
  });

  return PointsLog;
};
