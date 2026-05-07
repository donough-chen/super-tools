import { Application } from 'egg';
import { DataTypes, Model } from 'sequelize';

export default (app: Application) => {
  const { STRING, INTEGER, TINYINT, DATE } = DataTypes;

  const UserSession = app.model.define('UserSession', {
    id: { type: INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
    sessionId: { type: STRING(64), allowNull: false, unique: true, field: 'session_id' },
    userId: { type: INTEGER.UNSIGNED, allowNull: false, field: 'user_id' },
    clientId: { type: STRING(64), allowNull: false, field: 'client_id' },
    platform: { type: STRING(30), allowNull: false },
    accessToken: { type: STRING(512), allowNull: false, field: 'access_token' },
    refreshToken: { type: STRING(512), allowNull: false, field: 'refresh_token' },
    accessExpireAt: { type: DATE, allowNull: false, field: 'access_expire_at' },
    refreshExpireAt: { type: DATE, allowNull: false, field: 'refresh_expire_at' },
    ip: { type: STRING(50), allowNull: true },
    userAgent: { type: STRING(500), allowNull: true, field: 'user_agent' },
    deviceId: { type: STRING(100), allowNull: true, field: 'device_id' },
    deviceName: { type: STRING(100), allowNull: true, field: 'device_name' },
    location: { type: STRING(100), allowNull: true },
    isActive: { type: TINYINT, defaultValue: 1, field: 'is_active' },
    logoutAt: { type: DATE, allowNull: true, field: 'logout_at' },
    logoutType: { type: TINYINT.UNSIGNED, allowNull: true, field: 'logout_type' },
  }, {
    tableName: 'user_sessions',
    timestamps: true,
    underscored: true,
  });

  return UserSession;
};
