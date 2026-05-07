import { Application } from 'egg';
import { DataTypes } from 'sequelize';

export interface MemberLevelAttributes {
  id: number;
  name: string;
  code: string;
  level: number;
  icon?: string;
  color?: string;
  upgradePoints: number;
  upgradeGrowth: number;
  upgradeConsume: number;
  benefits?: object;
  description?: string;
  sort: number;
  status: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export default (app: Application) => {
  const { STRING, INTEGER, TINYINT, DECIMAL, JSON: JSONTYPE } = DataTypes;

  const MemberLevel = app.model.define('MemberLevel', {
    id: { type: INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
    name: { type: STRING(50), allowNull: false },
    code: { type: STRING(30), allowNull: false, unique: true },
    level: { type: TINYINT.UNSIGNED, allowNull: false, unique: true },
    icon: { type: STRING(500), allowNull: true },
    color: { type: STRING(20), allowNull: true },
    upgradePoints: { type: INTEGER.UNSIGNED, defaultValue: 0, field: 'upgrade_points' },
    upgradeGrowth: { type: INTEGER.UNSIGNED, defaultValue: 0, field: 'upgrade_growth' },
    upgradeConsume: { type: DECIMAL(10, 2), defaultValue: 0, field: 'upgrade_consume' },
    benefits: { type: JSONTYPE, allowNull: true },
    description: { type: STRING(500), allowNull: true },
    sort: { type: INTEGER, defaultValue: 0 },
    status: { type: TINYINT.UNSIGNED, defaultValue: 1 },
  }, {
    tableName: 'member_levels',
    timestamps: true,
    underscored: true,
  });

  return MemberLevel;
};
