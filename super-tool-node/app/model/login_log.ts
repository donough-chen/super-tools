import { Application } from 'egg';
import { DataTypes, Model } from 'sequelize';

export default (app: Application) => {
  const { STRING, INTEGER, TINYINT } = DataTypes;

  const LoginLog = app.model.define('LoginLog', {
    id: { type: INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
    userId: { type: INTEGER.UNSIGNED, allowNull: true, field: 'user_id' },
    username: { type: STRING(100), allowNull: true },
    clientId: { type: STRING(64), allowNull: true, field: 'client_id' },
    platform: { type: STRING(30), allowNull: false },
    loginType: { type: STRING(30), allowNull: false, field: 'login_type' },
    ip: { type: STRING(50), allowNull: true },
    userAgent: { type: STRING(500), allowNull: true, field: 'user_agent' },
    deviceId: { type: STRING(100), allowNull: true, field: 'device_id' },
    location: { type: STRING(100), allowNull: true },
    status: { type: TINYINT.UNSIGNED, defaultValue: 1 },
    failReason: { type: STRING(200), allowNull: true, field: 'fail_reason' },
  }, {
    tableName: 'login_logs',
    timestamps: true,
    updatedAt: false,
    underscored: true,
  });

  return LoginLog;
};
