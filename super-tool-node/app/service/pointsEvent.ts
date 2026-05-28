import { Service } from 'egg';
import { Op, Order } from 'sequelize';

/**
 * 领域事件追溯 Service（管理端）
 *
 *  设计依据:
 *    - docs/superpowers/specs/2026-05-27-积分成长体系后端优化设计文档.md §2.4-#16
 *    - docs/superpowers/plans/2026-05-28-积分管理模块管理端实施计划.md §Task 12
 *    - 数据表: database/026_points_growth_system_optimization.sql §16 (domain_events)
 *    - Model:  app/model/domain_event.ts
 *
 *  能力：
 *    1. list({ filters, page, pageSize })  按多维度筛选 + 分页查询
 *    2. retry(id)                          单条重试派发（status=failed → emitted, retry_count+1）
 *
 *  备注：
 *    - retry 仅做"标记重置"，实际派发由订阅系统的下一轮调度托底；
 *      当前阶段不主动调用 dispatcher（避免与 task.onEvent 形成并发竞争）。
 *    - failed → emitted 后，last_error 置空，retry_count 累加。
 */
export interface ListEventsParams {
  eventCode?: string;
  userId?: number;
  status?: 'emitted' | 'dispatched' | 'failed';
  startTime?: string;
  endTime?: string;
  page?: number;
  pageSize?: number;
}

export default class PointsEventService extends Service {
  /**
   * 多条件分页查询领域事件
   *  默认按 created_at DESC 排序，便于运维快速看到最新失败事件。
   */
  async list(params: ListEventsParams) {
    const { ctx } = this;
    const where: any = {};

    if (params.eventCode) where.eventCode = params.eventCode;
    if (params.userId) where.userId = params.userId;
    if (params.status) where.status = params.status;
    if (params.startTime || params.endTime) {
      where.createdAt = {};
      if (params.startTime) where.createdAt[Op.gte] = new Date(params.startTime);
      if (params.endTime) where.createdAt[Op.lte] = new Date(params.endTime);
    }

    const page = Math.max(1, Number(params.page) || 1);
    const pageSize = Math.min(200, Math.max(1, Number(params.pageSize) || 50));
    const order: Order = [['createdAt', 'DESC']];

    const { rows, count } = await (ctx.model as any).DomainEvent.findAndCountAll({
      where,
      order,
      limit: pageSize,
      offset: (page - 1) * pageSize,
    });

    return { list: rows, total: count, page, pageSize };
  }

  /**
   * 单条重试派发
   *  - 仅允许从 status=failed 触发，其他状态返回 400
   *  - 重置 status=emitted, last_error=null, retry_count++
   *  - 实际派发交由订阅系统下一轮调度（task.onEvent 等）兜底
   */
  async retry(id: number) {
    const { ctx } = this;
    if (!id || id <= 0) ctx.throw(400, 'id 必须是正整数');

    const evt = await (ctx.model as any).DomainEvent.findByPk(id);
    if (!evt) ctx.throw(404, '领域事件不存在');
    if (evt.status !== 'failed') {
      ctx.throw(400, `仅 status=failed 的事件可重试，当前 status=${evt.status}`);
    }

    await evt.update({
      status: 'emitted',
      lastError: null,
      retryCount: (evt.retryCount || 0) + 1,
    });

    return {
      id: evt.id,
      eventCode: evt.eventCode,
      retryCount: evt.retryCount,
      status: evt.status,
    };
  }
}
