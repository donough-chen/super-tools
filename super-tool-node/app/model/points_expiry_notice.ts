import { Application } from 'egg';
import { DataTypes } from 'sequelize';

export interface PointsExpiryNoticeAttributes {
  id: number;
  userId: number;
  noticeDate: string;
  noticeStage: number;     // 1=T-30, 2=T-7, 3=T-0
  expireDate: string;
  pointsAmount: number;
  channels?: string[];
  createdAt?: Date;
}

export default (app: Application) => {
  const { INTEGER, BIGINT, DATEONLY, TINYINT, JSON: JSON_TYPE } = DataTypes;

  return app.model.define('PointsExpiryNotice', {
    id: { type: BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
    userId: { type: BIGINT.UNSIGNED, allowNull: false, field: 'user_id' },
    noticeDate: { type: DATEONLY, allowNull: false, field: 'notice_date' },
    noticeStage: { type: TINYINT.UNSIGNED, allowNull: false, field: 'notice_stage' },
    expireDate: { type: DATEONLY, allowNull: false, field: 'expire_date' },
    pointsAmount: { type: INTEGER.UNSIGNED, allowNull: false, field: 'points_amount' },
    channels: { type: JSON_TYPE, allowNull: true },
  }, {
    tableName: 'points_expiry_notices',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false,
    underscored: true,
  });
};
