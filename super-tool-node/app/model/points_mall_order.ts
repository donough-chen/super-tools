import { Application } from 'egg';
import { DataTypes } from 'sequelize';

export interface PointsMallOrderAttributes {
  id: number;
  orderNo: string;
  userId: number;
  itemId: number;
  costPoints: number;
  productSnapshot: any;
  pointsLogId?: number;
  fulfillStatus: 'pending' | 'fulfilled' | 'shipping' | 'failed' | 'refunded';
  fulfillResult?: any;
  fulfilledAt?: Date;
  receiverName?: string;
  receiverPhone?: string;
  receiverAddress?: string;
  expressCompany?: string;
  expressNo?: string;
  shippedAt?: Date;
  refundStatus: 'none' | 'requested' | 'approved' | 'rejected' | 'refunded';
  refundReason?: string;
  refundedAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

export default (app: Application) => {
  const { STRING, INTEGER, BIGINT, DATE, JSON: JSON_TYPE, ENUM } = DataTypes;

  return app.model.define('PointsMallOrder', {
    id: { type: BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
    orderNo: { type: STRING(32), allowNull: false, unique: true, field: 'order_no' },
    userId: { type: BIGINT.UNSIGNED, allowNull: false, field: 'user_id' },
    itemId: { type: INTEGER.UNSIGNED, allowNull: false, field: 'item_id' },
    costPoints: { type: INTEGER.UNSIGNED, allowNull: false, field: 'cost_points' },
    productSnapshot: { type: JSON_TYPE, allowNull: false, field: 'product_snapshot' },
    pointsLogId: { type: BIGINT.UNSIGNED, allowNull: true, field: 'points_log_id' },
    fulfillStatus: { type: ENUM('pending', 'fulfilled', 'shipping', 'failed', 'refunded'), defaultValue: 'pending', field: 'fulfill_status' },
    fulfillResult: { type: JSON_TYPE, allowNull: true, field: 'fulfill_result' },
    fulfilledAt: { type: DATE, allowNull: true, field: 'fulfilled_at' },
    // 实物字段（虚拟商品时全部 NULL）
    receiverName: { type: STRING(50), allowNull: true, field: 'receiver_name' },
    receiverPhone: { type: STRING(20), allowNull: true, field: 'receiver_phone' },
    receiverAddress: { type: STRING(500), allowNull: true, field: 'receiver_address' },
    expressCompany: { type: STRING(50), allowNull: true, field: 'express_company' },
    expressNo: { type: STRING(50), allowNull: true, field: 'express_no' },
    shippedAt: { type: DATE, allowNull: true, field: 'shipped_at' },
    // 退款字段
    refundStatus: { type: ENUM('none', 'requested', 'approved', 'rejected', 'refunded'), defaultValue: 'none', field: 'refund_status' },
    refundReason: { type: STRING(200), allowNull: true, field: 'refund_reason' },
    refundedAt: { type: DATE, allowNull: true, field: 'refunded_at' },
  }, {
    tableName: 'points_mall_orders',
    timestamps: true,
    underscored: true,
  });
};
