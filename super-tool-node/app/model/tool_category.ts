import { Application } from 'egg';
import { DataTypes } from 'sequelize';

export interface ToolCategoryAttributes {
  id: number;
  code: string;
  name: string;
  icon?: string | null;
  description?: string | null;
  sort: number;
  status: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export default (app: Application) => {
  const { STRING, INTEGER, TINYINT } = DataTypes;

  const ToolCategory = app.model.define('ToolCategory', {
    id:          { type: INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
    code:        { type: STRING(30), allowNull: false, unique: true },
    name:        { type: STRING(50), allowNull: false },
    icon:        { type: STRING(500), allowNull: true },
    description: { type: STRING(500), allowNull: true },
    sort:        { type: INTEGER, allowNull: false, defaultValue: 0 },
    status:      { type: TINYINT.UNSIGNED, allowNull: false, defaultValue: 1 },
  }, {
    tableName: 'tool_categories',
    timestamps: true,
    underscored: true,
  });

  (ToolCategory as any).associate = () => {
    ToolCategory.hasMany(app.model.Tool, { foreignKey: 'category_id', as: 'tools' });
  };

  return ToolCategory;
};
