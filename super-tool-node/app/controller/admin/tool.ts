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
    const body = this.ctx.request.body;
    try {
      const data = await this.service.tool.createCategory(body);
      await this.service.audit.log({
        module: 'category', action: 'create',
        bizType: 'category', bizId: (data as any)?.id,
        afterData: data,
        description: `创建分类 ${body?.code || ''}`,
        status: 1,
      });
      this.created(data);
    } catch (e: any) {
      await this.service.audit.log({
        module: 'category', action: 'create',
        description: `尝试创建分类 ${body?.code || '(未知)'}`,
        status: 0, failReason: e.message,
      });
      throw e;
    }
  }

  /** PUT /api/admin/tool-categories/:id */
  async updateCategory() {
    const id = Number(this.ctx.params.id);
    let beforeData: any = null;
    try { beforeData = await this.service.tool.getCategoryById?.(id); } catch { /* ignore */ }

    try {
      const data = await this.service.tool.updateCategory(id, this.ctx.request.body);
      await this.service.audit.log({
        module: 'category', action: 'update',
        bizType: 'category', bizId: id,
        beforeData, afterData: data,
        description: `更新分类 #${id}`,
        status: 1,
      });
      this.success(data, '更新成功');
    } catch (e: any) {
      await this.service.audit.log({
        module: 'category', action: 'update',
        bizType: 'category', bizId: id,
        beforeData,
        description: `尝试更新分类 #${id}`,
        status: 0, failReason: e.message,
      });
      throw e;
    }
  }

  /** DELETE /api/admin/tool-categories/:id */
  async deleteCategory() {
    const id = Number(this.ctx.params.id);
    let beforeData: any = null;
    try { beforeData = await this.service.tool.getCategoryById?.(id); } catch { /* ignore */ }

    try {
      await this.service.tool.deleteCategory(id);
      await this.service.audit.log({
        module: 'category', action: 'delete',
        bizType: 'category', bizId: id,
        beforeData,
        description: `删除分类 #${id}`,
        status: 1,
      });
      this.success(null, '删除成功');
    } catch (e: any) {
      await this.service.audit.log({
        module: 'category', action: 'delete',
        bizType: 'category', bizId: id,
        beforeData,
        description: `尝试删除分类 #${id}`,
        status: 0, failReason: e.message,
      });
      throw e;
    }
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
    const body = this.ctx.request.body;
    try {
      const data = await this.service.tool.createTool(body);
      await this.service.audit.log({
        module: 'tool', action: 'create',
        bizType: 'tool', bizId: (data as any)?.id,
        afterData: data,
        description: `创建工具 ${body?.code || ''}`,
        status: 1,
      });
      this.created(data);
    } catch (e: any) {
      await this.service.audit.log({
        module: 'tool', action: 'create',
        description: `尝试创建工具 ${body?.code || '(未知)'}`,
        status: 0, failReason: e.message,
      });
      throw e;
    }
  }

  /** PUT /api/admin/tools/:id */
  async updateTool() {
    const id = Number(this.ctx.params.id);
    let beforeData: any = null;
    try { beforeData = await this.service.tool.getToolById(id); } catch { /* ignore */ }

    try {
      const data = await this.service.tool.updateTool(id, this.ctx.request.body);
      await this.service.audit.log({
        module: 'tool', action: 'update',
        bizType: 'tool', bizId: id,
        beforeData, afterData: data,
        description: `更新工具 #${id}`,
        status: 1,
      });
      this.success(data, '更新成功');
    } catch (e: any) {
      await this.service.audit.log({
        module: 'tool', action: 'update',
        bizType: 'tool', bizId: id,
        beforeData,
        description: `尝试更新工具 #${id}`,
        status: 0, failReason: e.message,
      });
      throw e;
    }
  }

  /** DELETE /api/admin/tools/:id */
  async deleteTool() {
    const id = Number(this.ctx.params.id);
    let beforeData: any = null;
    try { beforeData = await this.service.tool.getToolById(id); } catch { /* ignore */ }

    try {
      await this.service.tool.deleteTool(id);
      await this.service.audit.log({
        module: 'tool', action: 'delete',
        bizType: 'tool', bizId: id,
        beforeData,
        description: `删除工具 #${id}`,
        status: 1,
      });
      this.success(null, '删除成功');
    } catch (e: any) {
      await this.service.audit.log({
        module: 'tool', action: 'delete',
        bizType: 'tool', bizId: id,
        beforeData,
        description: `尝试删除工具 #${id}`,
        status: 0, failReason: e.message,
      });
      throw e;
    }
  }

  /** PUT /api/admin/tools/batch-publish */
  async batchPublish() {
    this.validate({
      ids: { type: 'array', itemType: 'number', required: true, min: 1, max: 500 },
      status: { type: 'enum', values: [0, 1], required: true },
    });
    const { ids, status } = this.ctx.request.body;
    const idsLabel = (ids as number[]).slice(0, 10).join(',');  // 防 bizId 超长
    try {
      const data = await this.service.tool.batchPublish(ids, status);
      await this.service.audit.log({
        module: 'tool', action: 'batch_update',
        bizType: 'tool', bizId: idsLabel,
        afterData: { ids, status },
        description: `批量${status === 1 ? '上架' : '下架'} ${ids.length} 个工具`,
        status: 1,
      });
      this.success(data, '批量处理成功');
    } catch (e: any) {
      await this.service.audit.log({
        module: 'tool', action: 'batch_update',
        bizType: 'tool', bizId: idsLabel,
        description: `尝试批量${status === 1 ? '上架' : '下架'} ${ids.length} 个工具`,
        status: 0, failReason: e.message,
      });
      throw e;
    }
  }
}
