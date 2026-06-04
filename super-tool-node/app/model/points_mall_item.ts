import { Application } from 'egg';
import { DataTypes } from 'sequelize';

export interface PointsMallItemAttributes {
  id: number;
  name: string;
  icon?: string;
  description?: string;
  category: 'coupon' | 'member_days' | 'tool_unlock' | 'badge' | 'physical';
  isVirtual: number;
  costPoints: number;
  pointsRequired: number;  // 商品原价积分
  requiredLevel?: string;
  fulfillConfig: any;
  stock: number;
  dailyLimit: number;
  totalLimit: number;
  validFrom?: Date;
  validTo?: Date;
  sort: number;
  status: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export default (app: Application) => {
  const { STRING, INTEGER, TINYINT, DATE, JSON: JSON_TYPE, ENUM } = DataTypes;

  return app.model.define('PointsMallItem', {
    id: { type: INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
    name: { type: STRING(100), allowNull: false },
    icon: { type: STRING(500), allowNull: true },
    description: { type: STRING(500), allowNull: true },
    category: { type: ENUM('coupon', 'member_days', 'tool_unlock', 'badge', 'physical'), allowNull: false },
    isVirtual: { type: TINYINT, defaultValue: 1, field: 'is_virtual' },
    costPoints: { type: INTEGER.UNSIGNED, allowNull: false, field: 'cost_points' },
    pointsRequired: { type: INTEGER.UNSIGNED, allowNull: false, defaultValue: 0, field: 'points_required' },
    requiredLevel: { type: STRING(30), allowNull: true, field: 'required_level' },
    fulfillConfig: { type: JSON_TYPE, allowNull: false, field: 'fulfill_config' },
    stock: { type: INTEGER, defaultValue: -1 },
    dailyLimit: { type: INTEGER.UNSIGNED, defaultValue: 0, field: 'daily_limit' },
    totalLimit: { type: INTEGER.UNSIGNED, defaultValue: 0, field: 'total_limit' },
    validFrom: { type: DATE, allowNull: true, field: 'valid_from' },
    validTo: { type: DATE, allowNull: true, field: 'valid_to' },
    sort: { type: INTEGER, defaultValue: 0 },
    status: { type: TINYINT.UNSIGNED, defaultValue: 1 },
  }, {
    tableName: 'points_mall_items',
    timestamps: true,
    underscored: true,
  });
};
