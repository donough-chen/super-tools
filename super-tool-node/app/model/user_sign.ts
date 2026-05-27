import { Application } from 'egg';
import { DataTypes } from 'sequelize';

export interface UserSignAttributes {
  id: number;
  userId: number;
  signDate: string;
  streak: number;
  pointsEarned: number;
  growthEarned: number;
  levelId?: number;
  createdAt?: Date;
}

export default (app: Application) => {
  const { INTEGER, BIGINT, DATEONLY } = DataTypes;

  return app.model.define('UserSign', {
    id: { type: BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
    userId: { type: BIGINT.UNSIGNED, allowNull: false, field: 'user_id' },
    signDate: { type: DATEONLY, allowNull: false, field: 'sign_date' },
    streak: { type: INTEGER.UNSIGNED, defaultValue: 1 },
    pointsEarned: { type: INTEGER.UNSIGNED, defaultValue: 0, field: 'points_earned' },
    growthEarned: { type: INTEGER.UNSIGNED, defaultValue: 0, field: 'growth_earned' },
    levelId: { type: INTEGER.UNSIGNED, allowNull: true, field: 'level_id' },
  }, {
    tableName: 'user_signs',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false,
    underscored: true,
  });
};
