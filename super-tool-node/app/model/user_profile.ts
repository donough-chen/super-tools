import { Application } from 'egg';
import { DataTypes, Model } from 'sequelize';

export interface UserProfileAttributes {
  id: number;
  userId: number;
  bio?: string;
  signature?: string;
  regionCode?: string;
  language: string;
  timezone: string;
  referralCode?: string;
  invitedBy?: number;
  privacySettings?: object;
  notificationSettings?: object;
  createdAt?: Date;
  updatedAt?: Date;
}

export default (app: Application) => {
  const { STRING, INTEGER, JSON: JSONTYPE } = DataTypes;

  const UserProfile = app.model.define('UserProfile', {
    id: { type: INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
    userId: { type: INTEGER.UNSIGNED, allowNull: false, unique: true, field: 'user_id' },
    bio: { type: STRING(200), allowNull: true },
    signature: { type: STRING(100), allowNull: true },
    regionCode: { type: STRING(20), allowNull: true, field: 'region_code' },
    language: { type: STRING(10), allowNull: false, defaultValue: 'zh-CN' },
    timezone: { type: STRING(50), allowNull: false, defaultValue: 'Asia/Shanghai' },
    referralCode: { type: STRING(20), allowNull: true, unique: true, field: 'referral_code' },
    invitedBy: { type: INTEGER.UNSIGNED, allowNull: true, field: 'invited_by' },
    privacySettings: { type: JSONTYPE, allowNull: true, field: 'privacy_settings' },
    notificationSettings: { type: JSONTYPE, allowNull: true, field: 'notification_settings' },
  }, {
    tableName: 'user_profiles',
    timestamps: true,
    underscored: true,
  });

  (UserProfile as any).associate = () => {
    UserProfile.belongsTo(app.model.User, { foreignKey: 'user_id', as: 'user' });
  };

  return UserProfile;
};
