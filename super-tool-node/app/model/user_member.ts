import { Application } from 'egg';
import { DataTypes } from 'sequelize';

export interface UserMemberAttributes {
  id: number;
  userId: number;
  levelId: number;
  levelCode: string;
  growthValue: number;
  totalPoints: number;
  totalConsume: number;
  points: number;
  isPaid: number;
  paidPlanCode?: string;
  paidStartAt?: Date;
  paidExpireAt?: Date;
  levelExpireAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

export default (app: Application) => {
  const { STRING, INTEGER, BIGINT, TINYINT, DECIMAL, DATE } = DataTypes;

  const UserMember = app.model.define('UserMember', {
    id: { type: BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
    userId: { type: BIGINT.UNSIGNED, allowNull: false, unique: true, field: 'user_id' },
    levelId: { type: INTEGER.UNSIGNED, defaultValue: 1, field: 'level_id' },
    levelCode: { type: STRING(30), defaultValue: 'free', field: 'level_code' },
    growthValue: { type: INTEGER.UNSIGNED, defaultValue: 0, field: 'growth_value' },
    totalPoints: { type: INTEGER.UNSIGNED, defaultValue: 0, field: 'total_points' },
    totalConsume: { type: DECIMAL(12, 2), defaultValue: 0, field: 'total_consume' },
    points: { type: INTEGER.UNSIGNED, defaultValue: 0 },
    isPaid: { type: TINYINT, defaultValue: 0, field: 'is_paid' },
    paidPlanCode: { type: STRING(30), allowNull: true, field: 'paid_plan_code' },
    paidStartAt: { type: DATE, allowNull: true, field: 'paid_start_at' },
    paidExpireAt: { type: DATE, allowNull: true, field: 'paid_expire_at' },
    levelExpireAt: { type: DATE, allowNull: true, field: 'level_expire_at' },
  }, {
    tableName: 'user_members',
    timestamps: true,
    underscored: true,
  });

  (UserMember as any).associate = () => {
    UserMember.belongsTo(app.model.User, { foreignKey: 'user_id', as: 'user' });
    UserMember.belongsTo(app.model.MemberLevel, { foreignKey: 'level_id', as: 'level' });
  };

  return UserMember;
};
