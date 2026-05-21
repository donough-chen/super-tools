/**
 * @file 管理端 - 频控规则控制器
 * @description 管理通知发送频率限制规则的 CRUD。规则变更后自动清除 Redis 缓存使其立即生效。
 *              频控维度：global_user(全局用户级) | channel(渠道级) | type(类型级)
 * @module controller/admin/notification/rate-limit
 */
import BaseController from '../../base';

export default class NotificationRateLimitController extends BaseController {

  /** 频控规则列表（分页），支持按维度和启用状态筛选 */
  async list() {
    const { ctx } = this;
    const { scope, enabled, page = 1, pageSize = 20 } = ctx.query;
    const where: any = {};
    if (scope) where.scope = scope;
    if (enabled !== undefined) where.enabled = Number(enabled);

    const { rows, count } = await ctx.model.NotificationRateLimitConfig.findAndCountAll({
      where,
      offset: (Number(page) - 1) * Number(pageSize),
      limit: Number(pageSize),
      order: [['id', 'ASC']],
    });
    this.success({ list: rows, total: count });
  }

  /** 创建频控规则，创建后清除规则缓存 */
  async create() {
    const { ctx } = this;
    const row = await ctx.model.NotificationRateLimitConfig.create(ctx.request.body as any);
    await this._clearRuleCache();
    this.success(row);
  }

  /** 更新频控规则，更新后清除规则缓存 */
  async update() {
    const { ctx } = this;
    const id = Number(ctx.params.id);
    const row = await ctx.model.NotificationRateLimitConfig.findByPk(id);
    if (!row) ctx.throw(404, '规则不存在');
    await row.update(ctx.request.body as any);
    await this._clearRuleCache();
    this.success(row);
  }

  /** 删除频控规则，删除后清除规则缓存 */
  async destroy() {
    const { ctx } = this;
    const id = Number(ctx.params.id);
    const row = await ctx.model.NotificationRateLimitConfig.findByPk(id);
    if (!row) ctx.throw(404, '规则不存在');
    await row.destroy();
    await this._clearRuleCache();
    this.success();
  }

  /** 清除 Redis 中的频控规则缓存，使变更立即生效 */
  private async _clearRuleCache() {
    try { await this.app.redis.del('notif:rate_rules'); } catch {}
  }
}
