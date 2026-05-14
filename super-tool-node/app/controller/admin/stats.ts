import BaseController from '../base';

export default class AdminStatsController extends BaseController {
  /** GET /api/admin/stats/overview */
  async overview() {
    const data = await this.service.stats.overview();
    this.success(data);
  }

  /** GET /api/admin/stats/tool-usage?startTime&endTime&limit */
  async toolUsage() {
    const q = this.ctx.query as any;
    const data = await this.service.stats.getToolUsage({
      startTime: q.startTime,
      endTime: q.endTime,
      limit: q.limit ? Number(q.limit) : undefined,
    });
    this.success(data);
  }

  /** GET /api/admin/stats/user-active?startTime&endTime */
  async userActive() {
    const q = this.ctx.query as any;
    const data = await this.service.stats.getUserActive({
      startTime: q.startTime, endTime: q.endTime,
    });
    this.success(data);
  }

  /** GET /api/admin/stats/trend?metric&granularity&startTime&endTime */
  async trend() {
    const q = this.ctx.query as any;
    if (!q.metric) this.ctx.throw(422, 'metric required');
    const data = await this.service.stats.getTrend({
      metric: q.metric,
      granularity: q.granularity || 'day',
      startTime: q.startTime, endTime: q.endTime,
    });
    this.success(data);
  }

  /** GET /api/admin/stats/export?type=tool-usage|user-active|trend&... */
  async exportCsv() {
    const q = this.ctx.query as any;
    if (!q.type) this.ctx.throw(422, 'type required');
    await this.service.stats.exportCsv(q.type, q);
    // 不调 this.success — service 已经 set ctx.body = stream
  }

  /** GET /api/admin/stats/user-retention?startDate&endDate */
  async userRetention() {
    const { startDate, endDate } = this.ctx.query as any;
    if (!startDate || !endDate) {
      this.ctx.throw(422, '缺少 startDate 或 endDate 参数');
    }
    const data = await this.service.stats.getUserRetention(startDate, endDate);
    this.success(data);
  }

  /** GET /api/admin/stats/active-hours?days=7|30 */
  async activeHours() {
    const days = parseInt(this.ctx.query.days as string) || 7;
    const data = await this.service.stats.getActiveHours(days);
    this.success(data);
  }

  /** GET /api/admin/stats/tool-category?startDate&endDate */
  async toolCategory() {
    const { startDate, endDate } = this.ctx.query as any;
    const data = await this.service.stats.getToolCategory(startDate, endDate);
    this.success(data);
  }

  /** GET /api/admin/stats/operation-efficiency?startDate&endDate */
  async operationEfficiency() {
    const { startDate, endDate } = this.ctx.query as any;
    const data = await this.service.stats.getOperationEfficiency(startDate, endDate);
    this.success(data);
  }

  /** GET /api/admin/stats/user-growth?startDate&endDate&granularity */
  async userGrowth() {
    const { startDate, endDate, granularity } = this.ctx.query as any;
    const data = await this.service.stats.getUserGrowth(startDate, endDate, granularity || 'day');
    this.success(data);
  }
}
