import { Application } from 'egg';
import { DataTypes } from 'sequelize';

export default (app: Application) => {
  const { INTEGER, STRING, JSON: JSON_TYPE } = DataTypes;
  const DashboardWidget = app.model.define('DashboardWidget', {
    id:              { type: INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
    layoutId:        { type: INTEGER.UNSIGNED, allowNull: false, field: 'layout_id' },
    widgetType:      { type: STRING(30), allowNull: false, field: 'widget_type' },
    title:           { type: STRING(100), allowNull: true },
    dataConfig:      { type: JSON_TYPE, allowNull: false, field: 'data_config' },
    styleConfig:     { type: JSON_TYPE, allowNull: true, field: 'style_config' },
    position:        { type: JSON_TYPE, allowNull: false },
    refreshInterval: { type: INTEGER.UNSIGNED, defaultValue: 0, field: 'refresh_interval' },
  }, {
    tableName: 'dashboard_widgets',
    timestamps: true,
    underscored: true,
  });

  (DashboardWidget as any).associate = () => {
    DashboardWidget.belongsTo(app.model.DashboardLayout, { foreignKey: 'layout_id', as: 'layout' });
  };

  return DashboardWidget;
};
