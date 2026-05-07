import { Application } from 'egg';
import { DataTypes, Model } from 'sequelize';

export default (app: Application) => {
  const { STRING, INTEGER, TINYINT, DATE } = DataTypes;

  const UserVerification = app.model.define('UserVerification', {
    id: { type: INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
    userId: { type: INTEGER.UNSIGNED, allowNull: false, unique: true, field: 'user_id' },
    realName: { type: STRING(50), allowNull: false, field: 'real_name' },
    idType: { type: TINYINT.UNSIGNED, defaultValue: 1, field: 'id_type' },
    idNumber: { type: STRING(100), allowNull: false, field: 'id_number' },
    idFrontUrl: { type: STRING(500), allowNull: true, field: 'id_front_url' },
    idBackUrl: { type: STRING(500), allowNull: true, field: 'id_back_url' },
    status: { type: TINYINT.UNSIGNED, defaultValue: 0 },
    rejectReason: { type: STRING(200), allowNull: true, field: 'reject_reason' },
    verifiedAt: { type: DATE, allowNull: true, field: 'verified_at' },
    verifiedBy: { type: INTEGER.UNSIGNED, allowNull: true, field: 'verified_by' },
  }, {
    tableName: 'user_verifications',
    timestamps: true,
    underscored: true,
  });

  return UserVerification;
};
