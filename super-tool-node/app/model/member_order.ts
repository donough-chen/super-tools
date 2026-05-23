import { Application } from 'egg';
import { DataTypes } from 'sequelize';

export interface MemberOrderAttributes {
  id: number;
  orderNo: string;
  userId: number;
  planId: number;
  planCode: string;
  planSnapshot: object;
  amount: number;
  status: number;
  scene: number;
  sourcePlanCode?: string;
  sourceRemainingValue?: number;
  paidAt?: Date;
  cancelledAt?: Date;
  expireAt: Date;
  remark?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export default (app: Application) => {
  const { STRING, INTEGER, BIGINT, TINYINT, DECIMAL, JSON: JSONTYPE, DATE } = DataTypes;

  const MemberOrder = app.model.define('MemberOrder', {
    id: { type: BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
    orderNo: { type: STRING(32), allowNull: false, unique: true, field: 'order_no' },
    userId: { type: BIGINT.UNSIGNED, allowNull: false, field: 'user_id' },
    planId: { type: INTEGER.UNSIGNED, allowNull: false, field: 'plan_id' },
    planCode: { type: STRING(30), allowNull: false, field: 'plan_code' },
    planSnapshot: { type: JSONTYPE, allowNull: false, field: 'plan_snapshot' },
    amount: { type: DECIMAL(10, 2), allowNull: false },
    status: { type: TINYINT.UNSIGNED, defaultValue: 0 },
    scene: { type: TINYINT.UNSIGNED, defaultValue: 1 },
    sourcePlanCode: { type: STRING(30), allowNull: true, field: 'source_plan_code' },
    sourceRemainingValue: { type: DECIMAL(10, 2), allowNull: true, field: 'source_remaining_value' },
    paidAt: { type: DATE, allowNull: true, field: 'paid_at' },
    cancelledAt: { type: DATE, allowNull: true, field: 'cancelled_at' },
    expireAt: { type: DATE, allowNull: false, field: 'expire_at' },
    remark: { type: STRING(200), allowNull: true },
    // underscored: true 会把 createdAt/updatedAt 的 attribute 名也变成 snake_case
    // 这里显式声明 attribute 用驼峰、SQL 列用下划线，保证 toJSON 输出 createdAt/updatedAt
    createdAt: { type: DATE, field: 'created_at' },
    updatedAt: { type: DATE, field: 'updated_at' },
  }, {
    tableName: 'member_orders',
    timestamps: true,
    underscored: true,
  });

  (MemberOrder as any).associate = () => {
    MemberOrder.belongsTo(app.model.User, { foreignKey: 'user_id', as: 'user' });
    MemberOrder.hasMany(app.model.MemberPayment, { foreignKey: 'order_id', as: 'payments' });
    MemberOrder.hasMany(app.model.MemberRefund, { foreignKey: 'order_id', as: 'refunds' });
    MemberOrder.belongsTo(app.model.PaidPlan, { foreignKey: 'plan_id', as: 'plan' });
  };

  return MemberOrder;
};
