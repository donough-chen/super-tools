import BaseService, { PaginationResult, PaginationOptions } from './base';

// ==================== 类型定义 ====================

export interface ToolDto {
  id: number;
  code: string;
  name: string;
  description: string;
  keyword: string;
  categoryCode: string;
  icon: string;
  color: string;
  path: string;
  isFeature: number;
  requiredLevelCode: string;
  requirePaid: number;
  sort: number;
}

export interface CategoryDto {
  id: number;
  code: string;
  name: string;
  icon: string | null;
  description?: string | null;
  sort: number;
}

export type CategoryWithTools = CategoryDto & { tools: ToolDto[] };

export interface HomeAggregateResult {
  mode: 'aggregate';
  categories: CategoryWithTools[];
}

export interface HomePaginatedResult {
  mode: 'paginated';
  categories: CategoryDto[];
  tools: PaginationResult<ToolDto>;
}

export type HomeResult = HomeAggregateResult | HomePaginatedResult;

export interface AccessAllowed {
  allowed: true;
  tool: { code: string; name: string; path: string };
}
export interface AccessDenied {
  allowed: false;
  reason: 'need_level' | 'need_paid' | 'paid_expired';
  required: { levelCode: string; levelName: string; requirePaid: boolean };
  current: { levelCode: string; isPaid: boolean };
}
export type AccessResult = AccessAllowed | AccessDenied;

const HOME_AGGREGATE_CACHE_KEY = 'tool:home:aggregate';
const CATEGORIES_CACHE_KEY = 'tool:categories:all';
const HOME_AGGREGATE_TTL = 300;
const CATEGORIES_TTL = 600;

export default class ToolService extends BaseService {

  // ==================== H5 端 ====================

  /**
   * H5 首页接口（双模式）：
   *  - 无 categoryCode 且无 keyword → aggregate（聚合所有分类 + 全量已发布工具）
   *  - 否则 → paginated（分类全量 + 工具分页）
   */
  async getHomeData(query: {
    categoryCode?: string;
    keyword?: string;
    page?: number;
    pageSize?: number;
  }): Promise<HomeResult> {
    const { categoryCode, keyword, page, pageSize } = query;

    // -------- 聚合模式 --------
    if (!categoryCode && !keyword) {
      return this.getOrSetCache<HomeAggregateResult>(
        HOME_AGGREGATE_CACHE_KEY,
        async () => {
          const categoriesRaw = await this.fetchCategories();
          const tools = await this.ctx.model.Tool.findAll({
            where: { status: 1 },
            order: [['sort', 'ASC'], ['id', 'ASC']],
          });
          const toolsDto = tools.map((t: any) => this.toToolDto(t.toJSON()));

          // 按 categoryCode 分组
          const byCode: Record<string, ToolDto[]> = {};
          for (const t of toolsDto) {
            if (!byCode[t.categoryCode]) byCode[t.categoryCode] = [];
            byCode[t.categoryCode].push(t);
          }
          const categories: CategoryWithTools[] = categoriesRaw.map(c => ({
            ...c,
            tools: byCode[c.code] || [],
          }));
          return { mode: 'aggregate', categories };
        },
        HOME_AGGREGATE_TTL,
      );
    }

    // -------- 分页模式 --------
    const categories = await this.fetchCategories();
    const { Op } = require('sequelize');
    const where: any = { status: 1 };
    if (categoryCode) where.categoryCode = categoryCode;
    if (keyword) {
      const like = { [Op.like]: `%${keyword}%` };
      where[Op.or] = [{ name: like }, { description: like }, { keyword: like }];
    }

    const result = await this.paginate<any>(
      this.ctx.model.Tool,
      { where, order: [['sort', 'ASC'], ['id', 'ASC']] },
      { page, pageSize },
    );

    return {
      mode: 'paginated',
      categories,
      tools: {
        ...result,
        list: result.list.map((t: any) => this.toToolDto(t.toJSON ? t.toJSON() : t)),
      },
    };
  }

  /**
   * 特色 Tab：is_feature=1 AND status=1
   */
  async getFeatureTools(pagination: PaginationOptions): Promise<PaginationResult<ToolDto>> {
    const result = await this.paginate<any>(
      this.ctx.model.Tool,
      {
        where: { isFeature: 1, status: 1 },
        order: [['sort', 'ASC'], ['id', 'ASC']],
      },
      pagination,
    );
    return {
      ...result,
      list: result.list.map((t: any) => this.toToolDto(t.toJSON ? t.toJSON() : t)),
    };
  }

  /**
   * 会员专属 Tab：status=1 AND (required_level_code != 'free' OR require_paid = 1)
   */
  async getMemberTools(pagination: PaginationOptions): Promise<PaginationResult<ToolDto>> {
    const { Op } = require('sequelize');
    const result = await this.paginate<any>(
      this.ctx.model.Tool,
      {
        where: {
          status: 1,
          [Op.or]: [
            { requiredLevelCode: { [Op.ne]: 'free' } },
            { requirePaid: 1 },
          ],
        },
        order: [['sort', 'ASC'], ['id', 'ASC']],
      },
      pagination,
    );
    return {
      ...result,
      list: result.list.map((t: any) => this.toToolDto(t.toJSON ? t.toJSON() : t)),
    };
  }

  // ==================== 权限校验 ====================

  /**
   * 工具使用前权限校验（用户点击工具卡片跳转时调用）
   */
  async checkToolAccess(userId: number, toolCode: string): Promise<AccessResult> {
    const tool = await this.ctx.model.Tool.findOne({ where: { code: toolCode } });
    if (!tool) this.ctx.throw(404, '工具不存在');

    const t = (tool as any).toJSON();
    if (t.status !== 1) this.ctx.throw(400, '工具已下架');

    // 免费工具快速通道
    if (t.requiredLevelCode === 'free' && t.requirePaid === 0) {
      return { allowed: true, tool: { code: t.code, name: t.name, path: t.path } };
    }

    const member = await this.ctx.model.UserMember.findOne({
      where: { userId },
      include: [{ model: this.ctx.model.MemberLevel, as: 'level' }],
    });
    if (!member) this.ctx.throw(404, '会员记录不存在');

    const m = (member as any).toJSON();
    const currentLevelCode: string = m.levelCode;
    const currentLevelValue: number = m.level?.level ?? 0;
    const isPaid = !!m.isPaid;
    const paidExpireAt: Date | null = m.paidExpireAt ? new Date(m.paidExpireAt) : null;

    const requiredInfo = await this.getLevelByCode(t.requiredLevelCode);
    const requiredLevelValue = requiredInfo?.level ?? 0;
    const requiredLevelName = requiredInfo?.name ?? t.requiredLevelCode;

    if (currentLevelValue < requiredLevelValue) {
      return {
        allowed: false,
        reason: 'need_level',
        required: { levelCode: t.requiredLevelCode, levelName: requiredLevelName, requirePaid: t.requirePaid === 1 },
        current: { levelCode: currentLevelCode, isPaid },
      };
    }

    if (t.requirePaid === 1) {
      if (!isPaid) {
        return {
          allowed: false,
          reason: 'need_paid',
          required: { levelCode: t.requiredLevelCode, levelName: requiredLevelName, requirePaid: true },
          current: { levelCode: currentLevelCode, isPaid: false },
        };
      }
      if (paidExpireAt && paidExpireAt <= new Date()) {
        return {
          allowed: false,
          reason: 'paid_expired',
          required: { levelCode: t.requiredLevelCode, levelName: requiredLevelName, requirePaid: true },
          current: { levelCode: currentLevelCode, isPaid: true },
        };
      }
    }

    return { allowed: true, tool: { code: t.code, name: t.name, path: t.path } };
  }

  // ==================== 管理端 - 分类 ====================

  async listCategoriesAdmin(query: any): Promise<PaginationResult<any>> {
    const { keyword, status, ...pagination } = query;
    const { Op, literal } = require('sequelize');
    const where: any = {};
    if (status !== undefined) where.status = Number(status);
    if (keyword) {
      const like = { [Op.like]: `%${keyword}%` };
      where[Op.or] = [{ name: like }, { code: like }];
    }
    return this.paginate<any>(
      this.ctx.model.ToolCategory,
      {
        where,
        order: [['sort', 'ASC'], ['id', 'ASC']],
        attributes: {
          include: [
            [literal('(SELECT COUNT(*) FROM tools t WHERE t.category_id = ToolCategory.id)'), 'toolCount'],
          ],
        },
      },
      pagination,
    );
  }

  async createCategory(data: any) {
    const exist = await this.ctx.model.ToolCategory.findOne({ where: { code: data.code } });
    if (exist) this.ctx.throw(409, '分类编码已存在');
    const created = await this.ctx.model.ToolCategory.create({
      code: data.code,
      name: data.name,
      icon: data.icon ?? null,
      description: data.description ?? null,
      sort: data.sort ?? 0,
      status: data.status ?? 1,
    } as any);
    await this.clearCache('tool:*');
    return (created as any).toJSON();
  }

  async updateCategory(id: number, data: any) {
    const cat = await this.ctx.model.ToolCategory.findByPk(id);
    if (!cat) this.ctx.throw(404, '分类不存在');
    const oldCode = (cat as any).code;
    if (data.code && data.code !== oldCode) {
      const dup = await this.ctx.model.ToolCategory.findOne({ where: { code: data.code } });
      if (dup) this.ctx.throw(409, '分类编码已存在');
    }
    await (cat as any).update({
      ...(data.code !== undefined && { code: data.code }),
      ...(data.name !== undefined && { name: data.name }),
      ...(data.icon !== undefined && { icon: data.icon }),
      ...(data.description !== undefined && { description: data.description }),
      ...(data.sort !== undefined && { sort: data.sort }),
      ...(data.status !== undefined && { status: data.status }),
    });
    // code 变更时同步 tools.category_code 冗余字段
    if (data.code && data.code !== oldCode) {
      await this.ctx.model.Tool.update(
        { categoryCode: data.code },
        { where: { categoryId: id } } as any,
      );
    }
    await this.clearCache('tool:*');
    return (cat as any).toJSON();
  }

  async deleteCategory(id: number) {
    const cat = await this.ctx.model.ToolCategory.findByPk(id);
    if (!cat) this.ctx.throw(404, '分类不存在');
    const count = await this.ctx.model.Tool.count({ where: { categoryId: id } });
    if (count > 0) {
      this.ctx.throw(400, `该分类下尚有 ${count} 个工具，请先移除或删除后再操作`);
    }
    await (cat as any).destroy();
    await this.clearCache('tool:*');
  }

  // ==================== 管理端 - 工具 ====================

  async listToolsAdmin(query: any): Promise<PaginationResult<any>> {
    const { Op } = require('sequelize');
    const {
      categoryCode, status, isFeature, requiredLevelCode, requirePaid, keyword,
      ...pagination
    } = query;
    const where: any = {};
    if (categoryCode) where.categoryCode = categoryCode;
    if (status !== undefined) where.status = Number(status);
    if (isFeature !== undefined) where.isFeature = Number(isFeature);
    if (requiredLevelCode) where.requiredLevelCode = requiredLevelCode;
    if (requirePaid !== undefined) where.requirePaid = Number(requirePaid);
    if (keyword) {
      const like = { [Op.like]: `%${keyword}%` };
      where[Op.or] = [{ name: like }, { code: like }, { description: like }, { keyword: like }];
    }
    return this.paginate<any>(
      this.ctx.model.Tool,
      {
        where,
        order: [['updated_at', 'DESC']],
        include: [{ model: this.ctx.model.ToolCategory, as: 'category', attributes: ['id', 'code', 'name'] }],
      },
      pagination,
    );
  }

  async getToolById(id: number) {
    const tool = await this.ctx.model.Tool.findByPk(id, {
      include: [{ model: this.ctx.model.ToolCategory, as: 'category', attributes: ['id', 'code', 'name'] }],
    });
    if (!tool) this.ctx.throw(404, '工具不存在');
    return (tool as any).toJSON();
  }

  async createTool(data: any) {
    const exist = await this.ctx.model.Tool.findOne({ where: { code: data.code } });
    if (exist) this.ctx.throw(409, '工具编码已存在');
    const category = await this.ctx.model.ToolCategory.findByPk(data.categoryId);
    if (!category) this.ctx.throw(400, '分类不存在');
    const tool = await this.ctx.model.Tool.create({
      code: data.code,
      name: data.name,
      description: data.description || '',
      keyword: data.keyword || '',
      categoryId: data.categoryId,
      categoryCode: (category as any).code,
      icon: data.icon || '',
      color: data.color || '',
      path: data.path,
      isFeature: data.isFeature ?? 0,
      requiredLevelCode: data.requiredLevelCode ?? 'free',
      requirePaid: data.requirePaid ?? 0,
      status: data.status ?? 0,
      sort: data.sort ?? 0,
    } as any);
    await this.clearCache('tool:*');
    return (tool as any).toJSON();
  }

  async updateTool(id: number, data: any) {
    const tool = await this.ctx.model.Tool.findByPk(id);
    if (!tool) this.ctx.throw(404, '工具不存在');
    const oldCode = (tool as any).code;
    if (data.code && data.code !== oldCode) {
      const dup = await this.ctx.model.Tool.findOne({ where: { code: data.code } });
      if (dup) this.ctx.throw(409, '工具编码已存在');
    }
    let categoryCode: string | undefined;
    if (data.categoryId !== undefined && data.categoryId !== (tool as any).categoryId) {
      const category = await this.ctx.model.ToolCategory.findByPk(data.categoryId);
      if (!category) this.ctx.throw(400, '分类不存在');
      categoryCode = (category as any).code;
    }
    const updateData: any = {};
    const fields = [
      'code', 'name', 'description', 'keyword', 'categoryId',
      'icon', 'color', 'path', 'isFeature', 'requiredLevelCode',
      'requirePaid', 'status', 'sort',
    ];
    for (const f of fields) {
      if (data[f] !== undefined) updateData[f] = data[f];
    }
    if (categoryCode) updateData.categoryCode = categoryCode;
    await (tool as any).update(updateData);
    await this.clearCache('tool:*');
    return (tool as any).toJSON();
  }

  async deleteTool(id: number) {
    const tool = await this.ctx.model.Tool.findByPk(id);
    if (!tool) this.ctx.throw(404, '工具不存在');
    await (tool as any).destroy();
    await this.clearCache('tool:*');
  }

  /**
   * 批量发布/下架
   */
  async batchPublish(ids: number[], status: 0 | 1): Promise<{ affected: number }> {
    if (!Array.isArray(ids) || ids.length === 0) this.ctx.throw(422, '参数验证失败');
    if (ids.length > 500) this.ctx.throw(422, '单次最多处理 500 个工具');
    if (status !== 0 && status !== 1) this.ctx.throw(422, '参数验证失败');
    const { Op } = require('sequelize');
    const [affected] = await this.ctx.model.Tool.update(
      { status },
      { where: { id: { [Op.in]: ids } } } as any,
    );
    await this.clearCache('tool:*');

    // P2.4: 触发工具上线/下架通知（通知收藏了这些工具的用户）
    try {
      const typeCode = status === 1 ? 'BUSINESS_TOOL_PUBLISHED' : 'BUSINESS_TOOL_UNPUBLISHED';
      for (const toolId of ids) {
        const tool = await this.ctx.model.Tool.findByPk(toolId, { attributes: ['id', 'name', 'code'] });
        if (!tool) continue;
        // 查收藏该工具的用户
        const favorites = await this.ctx.model.UserToolFavorite.findAll({
          where: { toolCode: (tool as any).code },
          attributes: ['userId'],
          raw: true,
        });
        const userIds = favorites.map((f: any) => f.userId);
        if (userIds.length > 0) {
          await this.ctx.service.notification.core.sendByAudience({
            typeCode,
            audienceType: 'static',
            staticUserIds: userIds,
            variables: { toolName: (tool as any).name },
          });
        }
      }
    } catch (e: any) {
      this.ctx.logger.warn(`[tool.batchPublish] notification failed: ${e.message}`);
    }

    return { affected };
  }

  // ==================== 私有辅助 ====================

  private async fetchCategories(): Promise<CategoryDto[]> {
    return this.getOrSetCache<CategoryDto[]>(
      CATEGORIES_CACHE_KEY,
      async () => {
        const list = await this.ctx.model.ToolCategory.findAll({
          where: { status: 1 },
          order: [['sort', 'ASC'], ['id', 'ASC']],
        });
        return list.map((c: any) => {
          const j = c.toJSON();
          return {
            id: j.id,
            code: j.code,
            name: j.name,
            icon: j.icon,
            description: j.description,
            sort: j.sort,
          };
        });
      },
      CATEGORIES_TTL,
    );
  }

  private toToolDto(t: any): ToolDto {
    return {
      id: t.id,
      code: t.code,
      name: t.name,
      description: t.description,
      keyword: t.keyword,
      categoryCode: t.categoryCode || t.category_code,
      icon: t.icon,
      color: t.color,
      path: t.path,
      isFeature: t.isFeature ?? t.is_feature,
      requiredLevelCode: t.requiredLevelCode || t.required_level_code,
      requirePaid: t.requirePaid ?? t.require_paid,
      sort: t.sort,
    };
  }

  private async getLevelByCode(code: string): Promise<{ level: number; name: string } | null> {
    // 复用 MemberService 的全量等级缓存
    const levels = await (this.service as any).member.getLevelList();
    const found = levels.find((l: any) => l.code === code);
    return found ? { level: found.level, name: found.name } : null;
  }
}
