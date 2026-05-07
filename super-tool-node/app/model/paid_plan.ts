import { Application } from 'egg';
import { DataTypes } from 'sequelize';

export interface PaidPlanAttributes {
  id: number;
  name: string;
  code: string;
  durationDays: number;
  price: number;
  originalPrice: number;
  benefits?: object;
  giftPoints: number;
  giftGrowth: number;
  description?: string;
  sort: number;
  status: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export default (app: Application) => {
  const { STRING, INTEGER, TINYINT, DECIMAL, JSON: JSONTYPE } = DataTypes;

  const PaidPlan = app.model.define('PaidPlan', {
    id: { type: INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
    name: { type: STRING(50), allowNull: false },
    code: { type: STRING(30), allowNull: false, unique: true },
    durationDays: { type: INTEGER.UNSIGNED, defaultValue: 0, field: 'duration_days' },
    price: { type: DECIMAL(10, 2), defaultValue: 0, allowNull: false },
    originalPrice: { type: DECIMAL(10, 2), defaultValue: 0, field: 'original_price' },
    benefits: { type: JSONTYPE, allowNull: true },
    giftPoints: { type: INTEGER.UNSIGNED, defaultValue: 0, field: 'gift_points' },
    giftGrowth: { type: INTEGER.UNSIGNED, defaultValue: 0, field: 'gift_growth' },
    description: { type: STRING(500), allowNull: true },
    sort: { type: INTEGER, defaultValue: 0 },
    status: { type: TINYINT.UNSIGNED, defaultValue: 1 },
  }, {
    tableName: 'paid_plans',
    timestamps: true,
    underscored: true,
  });

  return PaidPlan;
};
