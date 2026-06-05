import { Application } from 'egg';
import { DataTypes } from 'sequelize';

export interface UserCouponAttributes {
  id: number;
  userId: number;
  orderId: number;
  couponCode: string;
  couponType: 'fixed' | 'percent';
  discount: number;
  threshold: number;
  applicableScenes?: any;
  lockedPaymentId?: number;
  status: 'unused' | 'used' | 'expired';
  usedAt?: Date;
  expireAt: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

export default (app: Application) => {
  const { STRING, BIGINT, DATE, DECIMAL, ENUM, JSON: JSON_TYPE } = DataTypes;

  return app.model.define('UserCoupon', {
    id: { type: BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
    userId: { type: BIGINT.UNSIGNED, allowNull: false, field: 'user_id' },
    orderId: { type: BIGINT.UNSIGNED, allowNull: false, field: 'order_id' },
    couponCode: { type: STRING(50), allowNull: false, unique: true, field: 'coupon_code' },
    couponType: { type: ENUM('fixed', 'percent'), allowNull: false, field: 'coupon_type' },
    discount: { type: DECIMAL(10, 2), allowNull: false, field: 'discount' },
    threshold: { type: DECIMAL(10, 2), allowNull: false, defaultValue: 0, field: 'threshold' },
    applicableScenes: { type: JSON_TYPE, allowNull: true, field: 'applicable_scenes' },
    lockedPaymentId: { type: BIGINT.UNSIGNED, allowNull: true, field: 'locked_payment_id' },
    status: { type: ENUM('unused', 'used', 'expired'), allowNull: false, defaultValue: 'unused' },
    usedAt: { type: DATE, allowNull: true, field: 'used_at' },
    expireAt: { type: DATE, allowNull: false, field: 'expire_at' },
    createdAt: { type: DATE, field: 'created_at' },
    updatedAt: { type: DATE, field: 'updated_at' },
  }, {
    tableName: 'user_coupons',
    timestamps: true,
    underscored: true,
  });
};
