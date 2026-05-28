import BaseController from '../base';
import { pickFields } from '../../lib/pickFields';

/**
 * 任务管理控制器（管理端）
 *  设计依据: docs/superpowers/plans/2026-05-26-积分成长体系MVP实施计划-v2.md §Task 16
 *           docs/superpowers/specs/2026-05-27-积分成长体系后端优化设计文档.md §2.10-#29
 *
 *  路由（路由注册见 router.ts）：
 *    GET    /api/admin/points/tasks?category&status&page&pageSize
 *    POST   /api/admin/points/tasks
 *    PUT    /api/admin/points/tasks/:id
 *    DELETE /api/admin/points/tasks/:id
 *
 *  B7（spec §2.10-#29）：create/update 增字段白名单防注入。
 *    - CREATE 白名单含 code（业务唯一键，create 时必填）
 *    - UPDATE 白名单不含 code（code 是 immutable 业务键 + 任务事件路由依赖）
 */

/** 创建任务时允许写入的字段白名单（含 code） */
const TASK_CREATE_FIELDS = [
  'code',
  'name',
  'icon',
  'description',
  'category',
  'triggerEvent',
  'condition',
  'progressType',
  'progressTarget',
  'rewardPoints',
  'rewardGrowth',
  'resetCycle',
  'dailyCapGroup',
  'requiredLevel',
  'expireDays',
  'sort',
  'status',
] as const;

/** 更新任务时允许写入的字段白名单（不含 code，避免业务唯一键被改） */
const TASK_UPDATE_FIELDS = TASK_CREATE_FIELDS.filter(f => f !== 'code') as readonly string[];

export default class AdminTaskController extends BaseController {
  /** GET /api/admin/points/tasks */
  async list() {
    const { ctx } = this;
    const where: any = {};
    if (ctx.query.category) where.category = ctx.query.category;
    if (ctx.query.status !== undefined && ctx.query.status !== '') {
      where.status = Number(ctx.query.status);
    }
    const page = Number(ctx.query.page) || 1;
    const pageSize = Math.min(Number(ctx.query.pageSize) || 20, 100);
    const r: any = await ctx.model.Task.findAndCountAll({
      where,
      order: [['sort', 'ASC'], ['id', 'ASC']],
      limit: pageSize,
      offset: (page - 1) * pageSize,
    });
    this.success({ list: r.rows, total: r.count, page, pageSize });
  }

  /** POST /api/admin/points/tasks */
  async create() {
    const { ctx } = this;
    const body: any = pickFields(ctx.request.body, TASK_CREATE_FIELDS);
    if (!body.code || !body.name || !body.triggerEvent) {
      ctx.throw(400, 'code/name/triggerEvent 必填');
    }
    const t = await ctx.model.Task.create(body);
    this.success(t);
  }

  /** PUT /api/admin/points/tasks/:id */
  async update() {
    const { ctx } = this;
    const t: any = await ctx.model.Task.findByPk(ctx.params.id);
    if (!t) ctx.throw(404, '任务不存在');
    const body = pickFields(ctx.request.body, TASK_UPDATE_FIELDS);
    await t.update(body);
    this.success(t);
  }

  /** DELETE /api/admin/points/tasks/:id */
  async destroy() {
    const { ctx } = this;
    await ctx.model.Task.destroy({ where: { id: ctx.params.id } });
    this.success({ deleted: true });
  }
}
