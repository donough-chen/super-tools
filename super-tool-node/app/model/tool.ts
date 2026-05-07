import { Application } from 'egg';
import { DataTypes } from 'sequelize';

export interface ToolAttributes {
  id: number;
  code: string;
  name: string;
  description: string;
  keyword: string;
  categoryId: number;
  categoryCode: string;
  icon: string;
  color: string;
  path: string;
  isFeature: number;
  requiredLevelCode: string;
  requirePaid: number;
  status: number;
  sort: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export default (app: Application) => {
  const { STRING, INTEGER, BIGINT, TINYINT } = DataTypes;

  const Tool = app.model.define('Tool', {
    id:                { type: BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
    code:              { type: STRING(60), allowNull: false, unique: true },
    name:              { type: STRING(80), allowNull: false },
    description:       { type: STRING(500), allowNull: false, defaultValue: '' },
    keyword:           { type: STRING(500), allowNull: false, defaultValue: '' },
    categoryId:        { type: INTEGER.UNSIGNED, allowNull: false, field: 'category_id' },
    categoryCode:      { type: STRING(30), allowNull: false, field: 'category_code' },
    icon:              { type: STRING(500), allowNull: false, defaultValue: '' },
    color:             { type: STRING(20), allowNull: false, defaultValue: '' },
    path:              { type: STRING(200), allowNull: false, defaultValue: '' },
    isFeature:         { type: TINYINT.UNSIGNED, allowNull: false, defaultValue: 0, field: 'is_feature' },
    requiredLevelCode: { type: STRING(30), allowNull: false, defaultValue: 'free', field: 'required_level_code' },
    requirePaid:       { type: TINYINT.UNSIGNED, allowNull: false, defaultValue: 0, field: 'require_paid' },
    status:            { type: TINYINT.UNSIGNED, allowNull: false, defaultValue: 0 },
    sort:              { type: INTEGER, allowNull: false, defaultValue: 0 },
  }, {
    tableName: 'tools',
    timestamps: true,
    underscored: true,
  });

  (Tool as any).associate = () => {
    Tool.belongsTo(app.model.ToolCategory, { foreignKey: 'category_id', as: 'category' });
  };

  return Tool;
};
