import { Application } from 'egg';
import { DataTypes, Model } from 'sequelize';

export default (app: Application) => {
  const { STRING, INTEGER, TINYINT, DATE, JSON: JSONTYPE } = DataTypes;

  const UserOauth = app.model.define('UserOauth', {
    id: { type: INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
    userId: { type: INTEGER.UNSIGNED, allowNull: false, field: 'user_id' },
    platform: { type: STRING(30), allowNull: false },
    openId: { type: STRING(100), allowNull: false, field: 'open_id' },
    unionId: { type: STRING(100), allowNull: true, field: 'union_id' },
    accessToken: { type: STRING(500), allowNull: true, field: 'access_token' },
    refreshToken: { type: STRING(500), allowNull: true, field: 'refresh_token' },
    tokenExpireAt: { type: DATE, allowNull: true, field: 'token_expire_at' },
    nickname: { type: STRING(100), allowNull: true },
    avatar: { type: STRING(500), allowNull: true },
    rawData: { type: JSONTYPE, allowNull: true, field: 'raw_data' },
  }, {
    tableName: 'user_oauth',
    timestamps: true,
    underscored: true,
  });

  return UserOauth;
};
