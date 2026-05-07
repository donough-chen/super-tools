import BaseController from '../base';

/**
 * 管理端工具 Controller
 * 路由前缀: /api/admin/tool-categories  与  /api/admin/tools
 */
export default class AdminToolController extends BaseController {

  // ==================== 分类 ====================

  /** GET /api/admin/tool-categories */
  async listCategories() {
    const pagination = this.getPagination();
    const { keyword, status } = this.ctx.query;
    const result = await this.service.tool.listCategoriesAdmin({
      ...pagination,
      keyword: keyword ? String(keyword) : undefined,
      status: status !== undefined ? Number(status) : undefined,
    });
    this.paginated(result);
  }

  /** POST /api/admin/tool-categories */
  async createCategory() {
    this.validate({
      code: { type: 'string', required: true, min: 2, max: 30 },
      name: { type: 'string', required: true, min: 1, max: 50 },
      icon: { type: 'string', required: false, max: 500 },
      description: { type: 'string', required: false, max: 500 },
      sort: { type: 'number', required: false },
      status: { type: 'enum', values: [0, 1], required: false },
    });
    const data = await this.service.tool.createCategory(this.ctx.request.body);
    this.created(data);
  }

  /** PUT /api/admin/tool-categories/:id */
  async updateCategory() {
    const data = await this.service.tool.updateCategory(
      Number(this.ctx.params.id),
      this.ctx.request.body,
    );
    this.success(data, '更新成功');
  }

  /** DELETE /api/admin/tool-categories/:id */
  async deleteCategory() {
    await this.service.tool.deleteCategory(Number(this.ctx.params.id));
    this.success(null, '删除成功');
  }

  // ==================== 工具 ====================

  /** GET /api/admin/tools */
  async listTools() {
    const pagination = this.getPagination();
    const {
      categoryCode, status, isFeature, requiredLevelCode, requirePaid, keyword,
    } = this.ctx.query;
    const result = await this.service.tool.listToolsAdmin({
      ...pagination,
      categoryCode: categoryCode ? String(categoryCode) : undefined,
      status: status !== undefined ? Number(status) : undefined,
      isFeature: isFeature !== undefined ? Number(isFeature) : undefined,
      requiredLevelCode: requiredLevelCode ? String(requiredLevelCode) : undefined,
      requirePaid: requirePaid !== undefined ? Number(requirePaid) : undefined,
      keyword: keyword ? String(keyword) : undefined,
    });
    this.paginated(result);
  }

  /** GET /api/admin/tools/:id */
  async showTool() {
    const data = await this.service.tool.getToolById(Number(this.ctx.params.id));
    this.success(data);
  }

  /** POST /api/admin/tools */
  async createTool() {
    this.validate({
      code: { type: 'string', required: true, min: 2, max: 60 },
      name: { type: 'string', required: true, min: 1, max: 80 },
      description: { type: 'string', required: false, max: 500 },
      keyword: { type: 'string', required: false, max: 500 },
      categoryId: { type: 'number', required: true },
      icon: { type: 'string', required: false, max: 500 },
      color: { type: 'string', required: false, max: 20 },
      path: { type: 'string', required: true, min: 1, max: 200 },
      isFeature: { type: 'enum', values: [0, 1], required: false },
      requiredLevelCode: { type: 'enum', values: ['free', 'silver', 'gold', 'diamond', 'black'], required: false },
      requirePaid: { type: 'enum', values: [0, 1], required: false },
      status: { type: 'enum', values: [0, 1], required: false },
      sort: { type: 'number', required: false },
    });
    const data = await this.service.tool.createTool(this.ctx.request.body);
    this.created(data);
  }

  /** PUT /api/admin/tools/:id */
  async updateTool() {
    const data = await this.service.tool.updateTool(
      Number(this.ctx.params.id),
      this.ctx.request.body,
    );
    this.success(data, '更新成功');
  }

  /** DELETE /api/admin/tools/:id */
  async deleteTool() {
    await this.service.tool.deleteTool(Number(this.ctx.params.id));
    this.success(null, '删除成功');
  }

  /** PUT /api/admin/tools/batch-publish */
  async batchPublish() {
    this.validate({
      ids: { type: 'array', itemType: 'number', required: true, min: 1, max: 500 },
      status: { type: 'enum', values: [0, 1], required: true },
    });
    const { ids, status } = this.ctx.request.body;
    const data = await this.service.tool.batchPublish(ids, status);
    this.success(data, '批量处理成功');
  }
}
