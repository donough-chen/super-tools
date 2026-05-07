import { Application } from 'egg';
import { DataTypes, Model } from 'sequelize';

export default (app: Application) => {
  const { STRING, INTEGER, TINYINT } = DataTypes;

  const UserAddress = app.model.define('UserAddress', {
    id: { type: INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
    userId: { type: INTEGER.UNSIGNED, allowNull: false, field: 'user_id' },
    label: { type: STRING(20), allowNull: true },
    receiver: { type: STRING(50), allowNull: false },
    phone: { type: STRING(20), allowNull: false },
    province: { type: STRING(50), allowNull: false },
    city: { type: STRING(50), allowNull: false },
    district: { type: STRING(50), allowNull: false },
    address: { type: STRING(200), allowNull: false },
    postalCode: { type: STRING(10), allowNull: true, field: 'postal_code' },
    isDefault: { type: TINYINT, defaultValue: 0, field: 'is_default' },
  }, {
    tableName: 'user_addresses',
    paranoid: true,
    timestamps: true,
    underscored: true,
  });

  return UserAddress;
};
