import { Application } from 'egg';
import { DataTypes, Model } from 'sequelize';

export interface UserDeviceAttributes {
  id: number;
  userId: number;
  deviceId: string;
  deviceName?: string;
  deviceType: string;
  osVersion?: string;
  appVersion?: string;
  pushToken?: string;
  pushEnabled: number;
  lastActiveAt?: Date;
  status: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export default (app: Application) => {
  const { STRING, INTEGER, TINYINT, DATE } = DataTypes;

  const UserDevice = app.model.define('UserDevice', {
    id: { type: INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
    userId: { type: INTEGER.UNSIGNED, allowNull: false, field: 'user_id' },
    deviceId: { type: STRING(100), allowNull: false, field: 'device_id' },
    deviceName: { type: STRING(100), allowNull: true, field: 'device_name' },
    deviceType: { type: STRING(20), allowNull: false, field: 'device_type' },
    osVersion: { type: STRING(50), allowNull: true, field: 'os_version' },
    appVersion: { type: STRING(20), allowNull: true, field: 'app_version' },
    pushToken: { type: STRING(500), allowNull: true, field: 'push_token' },
    pushEnabled: { type: TINYINT, allowNull: false, defaultValue: 1, field: 'push_enabled' },
    lastActiveAt: { type: DATE, allowNull: true, field: 'last_active_at' },
    status: { type: TINYINT.UNSIGNED, allowNull: false, defaultValue: 1 },
  }, {
    tableName: 'user_devices',
    timestamps: true,
    underscored: true,
  });

  (UserDevice as any).associate = () => {
    UserDevice.belongsTo(app.model.User, { foreignKey: 'user_id', as: 'user' });
  };

  return UserDevice;
};
