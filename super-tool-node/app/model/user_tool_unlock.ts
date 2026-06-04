import { Application } from 'egg';
import { DataTypes } from 'sequelize';

export interface UserToolUnlockAttributes {
  id: number;
  userId: number;
  orderId: number;
  toolCode: string;
  unlockDays: number;
  unlockedAt: Date;
  expireAt: Date;
  status: 'active' | 'expired';
  createdAt?: Date;
  updatedAt?: Date;
}

export default (app: Application) => {
  const { STRING, INTEGER, BIGINT, DATE, ENUM } = DataTypes;

  return app.model.define('UserToolUnlock', {
    id: { type: BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
    userId: { type: BIGINT.UNSIGNED, allowNull: false, field: 'user_id' },
    orderId: { type: BIGINT.UNSIGNED, allowNull: false, field: 'order_id' },
    toolCode: { type: STRING(50), allowNull: false, field: 'tool_code' },
    unlockDays: { type: INTEGER.UNSIGNED, allowNull: false, defaultValue: 0, field: 'unlock_days' },
    unlockedAt: { type: DATE, allowNull: false, field: 'unlocked_at' },
    expireAt: { type: DATE, allowNull: false, field: 'expire_at' },
    status: { type: ENUM('active', 'expired'), allowNull: false, defaultValue: 'active' },
    createdAt: { type: DATE, field: 'created_at' },
    updatedAt: { type: DATE, field: 'updated_at' },
  }, {
    tableName: 'user_tool_unlocks',
    timestamps: true,
    underscored: true,
  });
};
