import { Application } from 'egg';
import { DataTypes, Model, Optional } from 'sequelize';

export interface UserAttributes {
  id: number;
  uuid: string;
  username?: string;
  email?: string;
  phone?: string;
  passwordHash?: string;
  nickname?: string;
  avatar?: string;
  gender: number;
  birthday?: string;
  userType: number;
  status: number;
  isVerified: number;
  registerSource: string;
  registerIp?: string;
  lastLoginAt?: Date;
  lastLoginIp?: string;
  lastLoginPlatform?: string;
  loginCount: number;
  extra?: object;
  createdAt?: Date;
  updatedAt?: Date;
  deletedAt?: Date;
}

export interface UserCreationAttributes
  extends Optional<UserAttributes, 'id' | 'gender' | 'userType' | 'status' | 'isVerified' | 'registerSource' | 'loginCount'> {}

export default (app: Application) => {
  const { STRING, INTEGER, TINYINT, DATE, DATEONLY, UUID, UUIDV4, JSON: JSONTYPE } = DataTypes;

  const User = app.model.define('User', {
    id: { type: INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
    uuid: { type: UUID, defaultValue: UUIDV4, allowNull: false, unique: true },
    username: { type: STRING(50), allowNull: true, unique: true },
    email: { type: STRING(100), allowNull: true, unique: true },
    phone: { type: STRING(20), allowNull: true, unique: true },
    passwordHash: { type: STRING(255), allowNull: true, field: 'password_hash' },
    nickname: { type: STRING(50), allowNull: true },
    avatar: { type: STRING(500), allowNull: true },
    gender: { type: TINYINT.UNSIGNED, defaultValue: 0 },
    birthday: { type: DATEONLY, allowNull: true },
    userType: { type: TINYINT.UNSIGNED, defaultValue: 1, field: 'user_type' },
    status: { type: TINYINT.UNSIGNED, defaultValue: 1 },
    isVerified: { type: TINYINT, defaultValue: 0, field: 'is_verified' },
    registerSource: { type: STRING(30), defaultValue: 'email', field: 'register_source' },
    registerIp: { type: STRING(50), allowNull: true, field: 'register_ip' },
    lastLoginAt: { type: DATE, allowNull: true, field: 'last_login_at' },
    lastLoginIp: { type: STRING(50), allowNull: true, field: 'last_login_ip' },
    lastLoginPlatform: { type: STRING(20), allowNull: true, field: 'last_login_platform' },
    loginCount: { type: INTEGER.UNSIGNED, defaultValue: 0, field: 'login_count' },
    extra: { type: JSONTYPE, allowNull: true },
  }, {
    tableName: 'users',
    paranoid: true,
    timestamps: true,
    underscored: true,
  });

  (User as any).associate = () => {
    User.belongsToMany(app.model.Role, { through: app.model.UserRole, foreignKey: 'user_id', otherKey: 'role_id', as: 'roles' });
  };

  return User;
};
