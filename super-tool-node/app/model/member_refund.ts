import { Application } from 'egg';
import { DataTypes } from 'sequelize';

export interface MemberRefundAttributes {
  id: number;
  refundNo: string;
  paymentId: number;
  orderId: number;
  userId: number;
  provider: string;
  providerRefundNo?: string;
  amount: number;
  status: number;
  reason?: string;
  failedReason?: string;
  operatorId: number;
  providerResponse?: object;
  refundedAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

export default (app: Application) => {
  const { STRING, BIGINT, TINYINT, DECIMAL, JSON: JSONTYPE, DATE } = DataTypes;

  const MemberRefund = app.model.define('MemberRefund', {
    id: { type: BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
    refundNo: { type: STRING(32), allowNull: false, unique: true, field: 'refund_no' },
    paymentId: { type: BIGINT.UNSIGNED, allowNull: false, field: 'payment_id' },
    orderId: { type: BIGINT.UNSIGNED, allowNull: false, field: 'order_id' },
    userId: { type: BIGINT.UNSIGNED, allowNull: false, field: 'user_id' },
    provider: { type: STRING(20), allowNull: false },
    providerRefundNo: { type: STRING(64), allowNull: true, field: 'provider_refund_no' },
    amount: { type: DECIMAL(10, 2), allowNull: false },
    // 0=处理中 1=成功 2=失败
    status: { type: TINYINT.UNSIGNED, defaultValue: 0 },
    reason: { type: STRING(200), allowNull: true },
    failedReason: { type: STRING(500), allowNull: true, field: 'failed_reason' },
    operatorId: { type: BIGINT.UNSIGNED, allowNull: false, field: 'operator_id' },
    providerResponse: { type: JSONTYPE, allowNull: true, field: 'provider_response' },
    refundedAt: { type: DATE, allowNull: true, field: 'refunded_at' },
    // 显式驼峰 attribute + 下划线列名，保证 toJSON 输出 createdAt/updatedAt
    createdAt: { type: DATE, field: 'created_at' },
    updatedAt: { type: DATE, field: 'updated_at' },
  }, {
    tableName: 'member_refunds',
    timestamps: true,
    underscored: true,
  });

  (MemberRefund as any).associate = () => {
    MemberRefund.belongsTo(app.model.MemberPayment, { foreignKey: 'payment_id', as: 'payment' });
    MemberRefund.belongsTo(app.model.MemberOrder, { foreignKey: 'order_id', as: 'order' });
    MemberRefund.belongsTo(app.model.User, { foreignKey: 'user_id', as: 'user' });
    MemberRefund.belongsTo(app.model.User, { foreignKey: 'operator_id', as: 'operator' });
  };

  return MemberRefund;
};
