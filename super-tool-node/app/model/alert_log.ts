import { Application } from 'egg';
import { DataTypes } from 'sequelize';

export default (app: Application) => {
  const { BIGINT, INTEGER, STRING, DECIMAL, DATE, JSON: JSON_TYPE } = DataTypes;
  const AlertLog = app.model.define('AlertLog', {
    id:              { type: BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
    ruleId:          { type: INTEGER.UNSIGNED, allowNull: false, field: 'rule_id' },
    ruleName:        { type: STRING(100), allowNull: false, field: 'rule_name' },
    metricType:      { type: STRING(50), allowNull: false, field: 'metric_type' },
    metricValue:     { type: DECIMAL(10, 2), allowNull: true, field: 'metric_value' },
    thresholdValue:  { type: DECIMAL(10, 2), allowNull: true, field: 'threshold_value' },
    conditionDesc:   { type: STRING(200), allowNull: true, field: 'condition_desc' },
    severity:        { type: STRING(20), allowNull: false },
    status:          { type: STRING(20), defaultValue: 'firing' },
    acknowledgedBy:  { type: INTEGER.UNSIGNED, allowNull: true, field: 'acknowledged_by' },
    acknowledgedAt:  { type: DATE, allowNull: true, field: 'acknowledged_at' },
    resolvedAt:      { type: DATE, allowNull: true, field: 'resolved_at' },
    resolveNote:     { type: STRING(500), allowNull: true, field: 'resolve_note' },
    details:         { type: JSON_TYPE, allowNull: true },
  }, {
    tableName: 'alert_logs',
    timestamps: true,
    updatedAt: false,
    underscored: true,
  });

  (AlertLog as any).associate = () => {
    AlertLog.belongsTo(app.model.AlertRule, { foreignKey: 'rule_id', as: 'rule' });
  };

  return AlertLog;
};
