import { Application } from 'egg';
import { DataTypes } from 'sequelize';

export default (app: Application) => {
  const { BIGINT, INTEGER, STRING, TEXT, DATE } = DataTypes;
  const ApiLog = app.model.define('ApiLog', {
    id:           { type: BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
    traceId:      { type: STRING(64), allowNull: true, field: 'trace_id' },
    userId:       { type: BIGINT.UNSIGNED, allowNull: true, field: 'user_id' },
    clientId:     { type: STRING(64), allowNull: true, field: 'client_id' },
    platform:     { type: STRING(30), allowNull: true },
    method:       { type: STRING(10), allowNull: false },
    path:         { type: STRING(500), allowNull: false },
    query:        { type: TEXT, allowNull: true },
    body:         { type: TEXT, allowNull: true },
    ip:           { type: STRING(50), allowNull: true },
    userAgent:    { type: STRING(500), allowNull: true, field: 'user_agent' },
    responseCode: { type: INTEGER, allowNull: true, field: 'response_code' },
    responseSize: { type: INTEGER.UNSIGNED, allowNull: true, field: 'response_size' },
    costTime:     { type: INTEGER.UNSIGNED, allowNull: true, field: 'cost_time' },
  }, {
    tableName: 'api_logs',
    timestamps: true,
    updatedAt: false,
    underscored: true,
  });

  return ApiLog;
};
