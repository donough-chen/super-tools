import { Application } from 'egg';
import { DataTypes, Model } from 'sequelize';

export default (app: Application) => {
  const { STRING, INTEGER, TINYINT, DATE } = DataTypes;

  const VerifyCode = app.model.define('VerifyCode', {
    id: { type: INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
    target: { type: STRING(100), allowNull: false },
    type: { type: STRING(30), allowNull: false },
    platform: { type: STRING(30), defaultValue: 'web' },
    code: { type: STRING(10), allowNull: false },
    ip: { type: STRING(50), allowNull: true },
    isUsed: { type: TINYINT, defaultValue: 0, field: 'is_used' },
    usedAt: { type: DATE, allowNull: true, field: 'used_at' },
    expireAt: { type: DATE, allowNull: false, field: 'expire_at' },
  }, {
    tableName: 'verify_codes',
    timestamps: true,
    updatedAt: false,
    underscored: true,
  });

  return VerifyCode;
};
