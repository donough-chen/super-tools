import { Application } from 'egg';
import { DataTypes } from 'sequelize';

export interface TaskAttributes {
  id: number;
  code: string;
  name: string;
  icon?: string;
  description?: string;
  category: 'newbie' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'achievement' | 'activity';
  triggerEvent: string;
  condition?: any;
  progressTarget: number;
  progressType: number;        // 1计数 2去重 3累计阈值 4直接覆盖
  rewardPoints: number;
  rewardGrowth: number;
  rewardExtra?: any;
  resetCycle: 'once' | 'daily' | 'weekly' | 'monthly' | 'yearly';
  validFrom?: Date;
  validTo?: Date;
  requiredLevel?: string;
  dailyCapGroup?: string;
  expireDays?: number;
  sort: number;
  status: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export default (app: Application) => {
  const { STRING, INTEGER, TINYINT, DATE, JSON: JSON_TYPE, ENUM } = DataTypes;

  const Task = app.model.define('Task', {
    id: { type: INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
    code: { type: STRING(50), allowNull: false, unique: true },
    name: { type: STRING(100), allowNull: false },
    icon: { type: STRING(500), allowNull: true },
    description: { type: STRING(500), allowNull: true },
    category: { type: ENUM('newbie', 'daily', 'weekly', 'monthly', 'yearly', 'achievement', 'activity'), allowNull: false },
    triggerEvent: { type: STRING(50), allowNull: false, field: 'trigger_event' },
    condition: { type: JSON_TYPE, allowNull: true },
    progressTarget: { type: INTEGER.UNSIGNED, defaultValue: 1, field: 'progress_target' },
    progressType: { type: TINYINT.UNSIGNED, defaultValue: 1, field: 'progress_type' },
    rewardPoints: { type: INTEGER.UNSIGNED, defaultValue: 0, field: 'reward_points' },
    rewardGrowth: { type: INTEGER.UNSIGNED, defaultValue: 0, field: 'reward_growth' },
    rewardExtra: { type: JSON_TYPE, allowNull: true, field: 'reward_extra' },
    resetCycle: { type: ENUM('once', 'daily', 'weekly', 'monthly', 'yearly'), defaultValue: 'once', field: 'reset_cycle' },
    validFrom: { type: DATE, allowNull: true, field: 'valid_from' },
    validTo: { type: DATE, allowNull: true, field: 'valid_to' },
    requiredLevel: { type: STRING(30), allowNull: true, field: 'required_level' },
    dailyCapGroup: { type: STRING(30), allowNull: true, field: 'daily_cap_group' },
    expireDays: { type: INTEGER.UNSIGNED, allowNull: true, field: 'expire_days' },
    sort: { type: INTEGER, defaultValue: 0 },
    status: { type: TINYINT.UNSIGNED, defaultValue: 1 },
  }, {
    tableName: 'tasks',
    timestamps: true,
    underscored: true,
  });

  return Task;
};
