import { Application } from 'egg';
import { DataTypes } from 'sequelize';

export interface AuditLogAttributes {
  id: number;
  traceId: string | null;
  userId: number | null;
  username: string | null;
  platform: string | null;
  module: string;
  action: string;
  description: string | null;
  bizType: string | null;
  bizId: string | null;
  beforeData: any | null;
  afterData: any | null;
  ip: string | null;
  userAgent: string | null;
  requestUrl: string | null;
  requestMethod: string | null;
  requestParams: any | null;
  responseCode: number | null;
  costTime: number | null;
  status: number;
  failReason: string | null;
  createdAt?: Date;
}

export default (app: Application) => {
  const { STRING, BIGINT, INTEGER, TINYINT, JSON: JSON_TYPE } = DataTypes;

  const AuditLog = app.model.define('AuditLog', {
    id:             { type: BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
    traceId:        { type: STRING(64),  allowNull: true,  field: 'trace_id' },
    userId:         { type: BIGINT.UNSIGNED, allowNull: true, field: 'user_id' },
    username:       { type: STRING(50),  allowNull: true },
    platform:       { type: STRING(30),  allowNull: true },
    module:         { type: STRING(50),  allowNull: false },
    action:         { type: STRING(50),  allowNull: false },
    description:    { type: STRING(500), allowNull: true },
    bizType:        { type: STRING(50),  allowNull: true,  field: 'biz_type' },
    bizId:          { type: STRING(64),  allowNull: true,  field: 'biz_id' },
    beforeData:     { type: JSON_TYPE,   allowNull: true,  field: 'before_data' },
    afterData:      { type: JSON_TYPE,   allowNull: true,  field: 'after_data' },
    ip:             { type: STRING(50),  allowNull: true },
    userAgent:      { type: STRING(500), allowNull: true,  field: 'user_agent' },
    requestUrl:     { type: STRING(500), allowNull: true,  field: 'request_url' },
    requestMethod:  { type: STRING(10),  allowNull: true,  field: 'request_method' },
    requestParams:  { type: JSON_TYPE,   allowNull: true,  field: 'request_params' },
    responseCode:   { type: INTEGER,     allowNull: true,  field: 'response_code' },
    costTime:       { type: INTEGER.UNSIGNED, allowNull: true, field: 'cost_time' },
    status:         { type: TINYINT.UNSIGNED, allowNull: false, defaultValue: 1 },
    failReason:     { type: STRING(500), allowNull: true,  field: 'fail_reason' },
  }, {
    tableName: 'audit_logs',
    timestamps: true,
    updatedAt: false,
    underscored: true,
  });

  return AuditLog;
};
