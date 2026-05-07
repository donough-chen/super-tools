import { Application } from 'egg';
import { DataTypes, Model } from 'sequelize';

export default (app: Application) => {
  const { INTEGER } = DataTypes;

  const RolePermission = app.model.define('RolePermission', {
    roleId: { type: INTEGER.UNSIGNED, primaryKey: true, field: 'role_id' },
    permissionId: { type: INTEGER.UNSIGNED, primaryKey: true, field: 'permission_id' },
  }, {
    tableName: 'role_permissions',
    timestamps: true,
    updatedAt: false,
    underscored: true,
  });

  return RolePermission;
};
