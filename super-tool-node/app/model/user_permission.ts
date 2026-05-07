import { Application } from 'egg';
import { DataTypes, Model } from 'sequelize';

export default (app: Application) => {
  const { INTEGER, TINYINT, DATE, STRING } = DataTypes;

  const UserPermission = app.model.define('UserPermission', {
    id: { type: INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
    userId: { type: INTEGER.UNSIGNED, allowNull: false, field: 'user_id' },
    permissionId: { type: INTEGER.UNSIGNED, allowNull: false, field: 'permission_id' },
    effect: { type: TINYINT.UNSIGNED, defaultValue: 1 },
    expireAt: { type: DATE, allowNull: true, field: 'expire_at' },
    grantedBy: { type: INTEGER.UNSIGNED, allowNull: true, field: 'granted_by' },
    reason: { type: STRING(200), allowNull: true },
  }, {
    tableName: 'user_permissions',
    timestamps: true,
    updatedAt: false,
    underscored: true,
  });

  return UserPermission;
};
