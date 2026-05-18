import BaseController from '../../base';

export default class NotificationRateLimitController extends BaseController {

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

  async create() {
    const { ctx } = this;
    const row = await ctx.model.NotificationRateLimitConfig.create(ctx.request.body as any);
    await this._clearRuleCache();
    this.success(row);
  }

  async update() {
    const { ctx } = this;
    const id = Number(ctx.params.id);
    const row = await ctx.model.NotificationRateLimitConfig.findByPk(id);
    if (!row) ctx.throw(404, '规则不存在');
    await row.update(ctx.request.body as any);
    await this._clearRuleCache();
    this.success(row);
  }

  async destroy() {
    const { ctx } = this;
    const id = Number(ctx.params.id);
    const row = await ctx.model.NotificationRateLimitConfig.findByPk(id);
    if (!row) ctx.throw(404, '规则不存在');
    await row.destroy();
    await this._clearRuleCache();
    this.success();
  }

  private async _clearRuleCache() {
    try { await this.app.redis.del('notif:rate_rules'); } catch {}
  }
}
