import { Application } from 'egg';
import { DataTypes, Model, Optional } from 'sequelize';

export interface RoleAttributes {
  id: number;
  name: string;
  code: string;
  type: number;
  platform: string;
  description?: string;
  sort: number;
  status: number;
  createdBy?: number;
  createdAt?: Date;
  updatedAt?: Date;
  deletedAt?: Date;
}

export interface RoleCreationAttributes extends Optional<RoleAttributes, 'id' | 'type' | 'platform' | 'sort' | 'status'> {}

export default (app: Application) => {
  const { STRING, INTEGER, TINYINT } = DataTypes;

  const Role = app.model.define('Role', {
    id: { type: INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
    name: { type: STRING(50), allowNull: false },
    code: { type: STRING(50), allowNull: false, unique: true },
    type: { type: TINYINT.UNSIGNED, defaultValue: 1 },
    platform: { type: STRING(30), defaultValue: 'all' },
    description: { type: STRING(200), allowNull: true },
    sort: { type: INTEGER, defaultValue: 0 },
    status: { type: TINYINT.UNSIGNED, defaultValue: 1 },
    createdBy: { type: INTEGER.UNSIGNED, allowNull: true, field: 'created_by' },
  }, {
    tableName: 'roles',
    paranoid: true,
    timestamps: true,
    underscored: true,
  });

  (Role as any).associate = () => {
    Role.belongsToMany(app.model.User, { through: app.model.UserRole, foreignKey: 'role_id', otherKey: 'user_id', as: 'users' });
    Role.belongsToMany(app.model.Permission, { through: app.model.RolePermission, foreignKey: 'role_id', otherKey: 'permission_id', as: 'permissions' });
  };

  return Role;
};
