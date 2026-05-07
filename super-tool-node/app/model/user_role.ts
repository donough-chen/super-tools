import { Application } from 'egg';
import { DataTypes, Model } from 'sequelize';

export default (app: Application) => {
  const { INTEGER, DATE } = DataTypes;

  const UserRole = app.model.define('UserRole', {
    userId: { type: INTEGER.UNSIGNED, primaryKey: true, field: 'user_id' },
    roleId: { type: INTEGER.UNSIGNED, primaryKey: true, field: 'role_id' },
    expireAt: { type: DATE, allowNull: true, field: 'expire_at' },
    grantedBy: { type: INTEGER.UNSIGNED, allowNull: true, field: 'granted_by' },
  }, {
    tableName: 'user_roles',
    timestamps: true,
    updatedAt: false,
    underscored: true,
  });

  return UserRole;
};
