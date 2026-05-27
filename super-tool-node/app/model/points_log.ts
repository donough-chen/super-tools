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
  // FIFO 融合字段（v2 新增，仅 type=1 时有意义）
  pointsRemaining: number;        // 剩余可用积分
  status: number;                 // 1可用 2已耗尽 3已过期 4已退款回收
  sourceLevelId?: number;         // 获得时的等级ID（用于过期时长计算）
  sourceEvent?: string;           // 来源事件 code
  growthMultiplier: number;       // 获得时应用的等级积分倍率
  createdAt?: Date;
}

export default (app: Application) => {
  const { STRING, INTEGER, BIGINT, TINYINT, DATE, DECIMAL } = DataTypes;

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
    // FIFO 融合字段（v2 新增）
    pointsRemaining: { type: INTEGER.UNSIGNED, defaultValue: 0, field: 'points_remaining' },
    status: { type: TINYINT.UNSIGNED, defaultValue: 1 },
    sourceLevelId: { type: INTEGER.UNSIGNED, allowNull: true, field: 'source_level_id' },
    sourceEvent: { type: STRING(50), allowNull: true, field: 'source_event' },
    growthMultiplier: { type: DECIMAL(4, 2), defaultValue: 1.00, field: 'growth_multiplier' },
  }, {
    tableName: 'points_logs',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false,
    underscored: true,
  });

  return PointsLog;
};
