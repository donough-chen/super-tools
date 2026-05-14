import BaseController from '../base';

export default class AdminAlertController extends BaseController {

  // ==================== 规则 ====================

  /** GET /api/admin/alerts/rules */
  async listRules() {
    const data = await this.service.alert.listRules(this.ctx.query);
    this.success(data);
  }

  /** POST /api/admin/alerts/rules */
  async createRule() {
    const body = this.ctx.request.body as any;
    const rule = await this.service.alert.createRule({
      ...body,
      createdBy: (this.ctx.state.user as any)?.id,
    });
    this.created(rule);
  }

  /** PUT /api/admin/alerts/rules/:id */
  async updateRule() {
    const id = Number(this.ctx.params.id);
    const rule = await this.service.alert.updateRule(id, this.ctx.request.body);
    this.success(rule);
  }

  /** DELETE /api/admin/alerts/rules/:id */
  async deleteRule() {
    const id = Number(this.ctx.params.id);
    await this.service.alert.deleteRule(id);
    this.success(null, '删除成功');
  }

  /** PUT /api/admin/alerts/rules/:id/toggle */
  async toggleRule() {
    const id = Number(this.ctx.params.id);
    const data = await this.service.alert.toggleRule(id);
    this.success(data);
  }

  // ==================== 记录 ====================

  /** GET /api/admin/alerts/logs */
  async listLogs() {
    const data = await this.service.alert.listLogs(this.ctx.query);
    this.success(data);
  }

  /** PUT /api/admin/alerts/logs/:id/acknowledge */
  async acknowledgLog() {
    const id = Number(this.ctx.params.id);
    const userId = (this.ctx.state.user as any)?.id;
    const log = await this.service.alert.acknowledgeLog(id, userId);
    this.success(log);
  }

  /** PUT /api/admin/alerts/logs/:id/resolve */
  async resolveLog() {
    const id = Number(this.ctx.params.id);
    const { resolve_note } = this.ctx.request.body as any;
    const log = await this.service.alert.resolveLog(id, resolve_note);
    this.success(log);
  }

  /** GET /api/admin/alerts/summary */
  async summary() {
    const data = await this.service.alert.getSummary();
    this.success(data);
  }
}
