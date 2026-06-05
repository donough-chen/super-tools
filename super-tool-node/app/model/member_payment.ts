import { Application } from 'egg';
import { DataTypes } from 'sequelize';

export interface MemberPaymentAttributes {
  id: number;
  paymentNo: string;
  orderId: number;
  userId: number;
  provider: string;
  providerTradeNo?: string;
  amount: number;
  couponId?: number;
  couponDiscountAmount?: number;
  status: number;
  prepayData?: object;
  callbackPayload?: object;
  paidAt?: Date;
  failedReason?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export default (app: Application) => {
  const { STRING, BIGINT, TINYINT, DECIMAL, JSON: JSONTYPE, DATE } = DataTypes;

  const MemberPayment = app.model.define('MemberPayment', {
    id: { type: BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
    paymentNo: { type: STRING(32), allowNull: false, unique: true, field: 'payment_no' },
    orderId: { type: BIGINT.UNSIGNED, allowNull: false, field: 'order_id' },
    userId: { type: BIGINT.UNSIGNED, allowNull: false, field: 'user_id' },
    provider: { type: STRING(20), allowNull: false },
    providerTradeNo: { type: STRING(64), allowNull: true, field: 'provider_trade_no' },
    amount: { type: DECIMAL(10, 2), allowNull: false },
    couponId: { type: BIGINT.UNSIGNED, allowNull: true, field: 'coupon_id' },
    couponDiscountAmount: { type: DECIMAL(10, 2), allowNull: false, defaultValue: 0, field: 'coupon_discount_amount' },
    status: { type: TINYINT.UNSIGNED, defaultValue: 0 },
    prepayData: { type: JSONTYPE, allowNull: true, field: 'prepay_data' },
    callbackPayload: { type: JSONTYPE, allowNull: true, field: 'callback_payload' },
    paidAt: { type: DATE, allowNull: true, field: 'paid_at' },
    failedReason: { type: STRING(500), allowNull: true, field: 'failed_reason' },
    // 见 member_order.ts 注释：保证 toJSON 输出驼峰 createdAt/updatedAt
    createdAt: { type: DATE, field: 'created_at' },
    updatedAt: { type: DATE, field: 'updated_at' },
  }, {
    tableName: 'member_payments',
    timestamps: true,
    underscored: true,
  });

  (MemberPayment as any).associate = () => {
    MemberPayment.belongsTo(app.model.MemberOrder, { foreignKey: 'order_id', as: 'order' });
    MemberPayment.hasMany(app.model.MemberRefund, { foreignKey: 'payment_id', as: 'refunds' });
  };

  return MemberPayment;
};
