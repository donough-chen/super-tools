import { Application } from 'egg';
import { DataTypes, Model, Optional } from 'sequelize';

export interface PermissionAttributes {
  id: number;
  parentId: number;
  name: string;
  code: string;
  type: number;
  module: string;
  platform: string;
  icon?: string;
  path?: string;
  component?: string;
  method?: string;
  redirect?: string;
  isHidden: number;
  isCache: number;
  isExternal: number;
  sort: number;
  status: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface PermissionCreationAttributes extends Optional<PermissionAttributes, 'id' | 'parentId' | 'type' | 'module' | 'platform' | 'isHidden' | 'isCache' | 'isExternal' | 'sort' | 'status'> {}

export default (app: Application) => {
  const { STRING, INTEGER, TINYINT } = DataTypes;

  const Permission = app.model.define('Permission', {
    id: { type: INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
    parentId: { type: INTEGER.UNSIGNED, defaultValue: 0, field: 'parent_id' },
    name: { type: STRING(100), allowNull: false },
    code: { type: STRING(100), allowNull: false, unique: true },
    type: { type: TINYINT.UNSIGNED, defaultValue: 1 },
    module: { type: STRING(50), allowNull: false, defaultValue: '' },
    platform: { type: STRING(30), defaultValue: 'admin' },
    icon: { type: STRING(100), allowNull: true },
    path: { type: STRING(200), allowNull: true },
    component: { type: STRING(200), allowNull: true },
    method: { type: STRING(10), allowNull: true },
    redirect: { type: STRING(200), allowNull: true },
    isHidden: { type: TINYINT, defaultValue: 0, field: 'is_hidden' },
    isCache: { type: TINYINT, defaultValue: 0, field: 'is_cache' },
    isExternal: { type: TINYINT, defaultValue: 0, field: 'is_external' },
    sort: { type: INTEGER, defaultValue: 0 },
    status: { type: TINYINT.UNSIGNED, defaultValue: 1 },
  }, {
    tableName: 'permissions',
    timestamps: true,
    underscored: true,
  });

  (Permission as any).associate = () => {
    Permission.belongsToMany(app.model.Role, { through: app.model.RolePermission, foreignKey: 'permission_id', otherKey: 'role_id', as: 'roles' });
  };

  return Permission;
};
