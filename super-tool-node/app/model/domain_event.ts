import { Application } from 'egg';
import { DataTypes } from 'sequelize';

/**
 * 领域事件追溯表 Model
 *  设计依据: docs/superpowers/specs/2026-05-27-积分成长体系后端优化设计文档.md §2.4-#16
 *  对应表: database/026_points_growth_system_optimization.sql 中 `domain_events`
 *
 *  status 流转：
 *    emitted     → 已发出（默认初始状态）
 *    dispatched  → 已成功派发到订阅方（task.onEvent 完成）
 *    failed      → 派发失败（last_error 记录原因，retry_count 累加）
 *
 *  写入策略：
 *    - emit 时同步写一行 status=emitted（A5）
 *    - dispatch 成功后可选择性 update 为 dispatched（B 阶段视情况开启）
 *    - 写库失败仅 logger.warn，不阻塞业务流（A5 强约束）
 */
export interface DomainEventAttributes {
  id: number;
  eventCode: string;
  userId: number;
  payload: any | null;
  status: 'emitted' | 'dispatched' | 'failed';
  retryCount: number;
  lastError: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export default (app: Application) => {
  const { STRING, BIGINT, INTEGER, TEXT, JSON: JSON_TYPE, DATE, ENUM } = DataTypes;

  const DomainEvent = app.model.define('DomainEvent', {
    id:         { type: BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
    eventCode:  { type: STRING(64),  allowNull: false, field: 'event_code' },
    userId:     { type: BIGINT.UNSIGNED, allowNull: false, field: 'user_id' },
    payload:    { type: JSON_TYPE,   allowNull: true },
    status:     { type: ENUM('emitted', 'dispatched', 'failed'), allowNull: false, defaultValue: 'emitted' },
    retryCount: { type: INTEGER.UNSIGNED, allowNull: false, defaultValue: 0, field: 'retry_count' },
    lastError:  { type: TEXT, allowNull: true, field: 'last_error' },
    createdAt: { type: DATE, allowNull: true, field: 'created_at' },
    updatedAt: { type: DATE, allowNull: true, field: 'updated_at' },
  }, {
    tableName: 'domain_events',
    timestamps: true,
    underscored: true,
  });

  return DomainEvent;
};
