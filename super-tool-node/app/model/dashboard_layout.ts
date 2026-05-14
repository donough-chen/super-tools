import { Application } from 'egg';
import { DataTypes } from 'sequelize';

export default (app: Application) => {
  const { INTEGER, STRING, TINYINT, JSON: JSON_TYPE } = DataTypes;
  const DashboardLayout = app.model.define('DashboardLayout', {
    id:           { type: INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
    userId:       { type: INTEGER.UNSIGNED, allowNull: true, field: 'user_id' },
    name:         { type: STRING(100), allowNull: false },
    description:  { type: STRING(500), allowNull: true },
    isDefault:    { type: TINYINT, defaultValue: 0, field: 'is_default' },
    isShared:     { type: TINYINT, defaultValue: 0, field: 'is_shared' },
    shareToken:   { type: STRING(64), allowNull: true, field: 'share_token' },
    layoutConfig: { type: JSON_TYPE, allowNull: false, field: 'layout_config' },
  }, {
    tableName: 'dashboard_layouts',
    timestamps: true,
    underscored: true,
  });

  return DashboardLayout;
};
