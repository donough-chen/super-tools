import { Application } from 'egg';
import { DataTypes } from 'sequelize';

export interface DailyPointsCapAttributes {
  id: number;
  userId: number;
  capDate: string;
  capGroup: string;       // task / invite
  earned: number;
  count: number;
}

export default (app: Application) => {
  const { STRING, INTEGER, BIGINT, DATEONLY } = DataTypes;

  return app.model.define('DailyPointsCap', {
    id: { type: BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
    userId: { type: BIGINT.UNSIGNED, allowNull: false, field: 'user_id' },
    capDate: { type: DATEONLY, allowNull: false, field: 'cap_date' },
    capGroup: { type: STRING(30), allowNull: false, field: 'cap_group' },
    earned: { type: INTEGER.UNSIGNED, defaultValue: 0 },
    count: { type: INTEGER.UNSIGNED, defaultValue: 0 },
  }, {
    tableName: 'daily_points_caps',
    timestamps: false,
    underscored: true,
  });
};
