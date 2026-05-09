import BaseService, { PaginationResult, PaginationOptions } from './base';

// ==================== 类型定义 ====================

export interface FavoriteToolDto {
  id: number;               // favorite 主键
  toolId: number;
  toolCode: string;
  sort: number;
  favoritedAt: Date;
  tool: {
    id: number;
    code: string;
    name: string;
    description: string;
    keyword: string;
    categoryCode: string;
    categoryName?: string;
    icon: string;
    color: string;
    path: string;
    isFeature: number;
    requiredLevelCode: string;
    requirePaid: number;
    status: number;
  };
}

export interface FavoriteListQuery extends PaginationOptions {
  keyword?: string;
  categoryCode?: string;
}

const SORT_STEP = 10;
const MAX_SORT = 2147483000;          // 接近 INT 上限的安全值

export default class FavoriteService extends BaseService {

  /**
   * POST /api/favorites — 新增收藏
   * 支持通过 toolId 或 toolCode 收藏
   * 幂等：重复收藏抛 409
   */
  async addFavorite(userId: number, params: { toolId?: number; toolCode?: string }) {
    if (!params.toolId && !params.toolCode) {
      this.ctx.throw(422, '必须提供 toolId 或 toolCode');
    }

    const tool = await this.resolveTool(params);
    if (!tool) this.ctx.throw(404, '工具不存在或已下架');

    const exist = await this.ctx.model.UserToolFavorite.findOne({
      where: { userId, toolId: tool.id },
    });
    if (exist) this.ctx.throw(409, '已收藏过该工具');

    // 新收藏置于列表末尾：sort = max(sort) + 10
    const max = await this.ctx.model.UserToolFavorite.max('sort', { where: { userId } });
    const nextSort = typeof max === 'number' ? Math.min(max + SORT_STEP, MAX_SORT) : SORT_STEP;

    const fav = await this.ctx.model.UserToolFavorite.create({
      userId,
      toolId: tool.id,
      toolCode: tool.code,
      sort: nextSort,
      favoritedAt: new Date(),
    } as any);

    return {
      id: (fav as any).id,
      toolId: tool.id,
      toolCode: tool.code,
      sort: nextSort,
    };
  }

  /**
   * DELETE /api/favorites/:toolCode — 取消收藏
   */
  async removeFavorite(userId: number, toolCode: string) {
    const fav = await this.ctx.model.UserToolFavorite.findOne({
      where: { userId, toolCode },
    });
    if (!fav) this.ctx.throw(404, '收藏记录不存在');
    await (fav as any).destroy();
  }

  /**
   * GET /api/favorites — 分页收藏列表
   * 支持 keyword（工具 name/description/keyword 模糊）、categoryCode 过滤
   * 默认按手动排序 sort ASC，兜底按 favorited_at DESC
   *
   * 实现说明：
   *   - 不走 BaseService.paginate，因为该方法会用默认 order 覆盖我们传入的 order
   *   - Sequelize include.where 在嵌套 Op.or 条件下，使用 distinct:true + col:id 确保 count 正确
   */
  async listFavorites(userId: number, query: FavoriteListQuery): Promise<PaginationResult<FavoriteToolDto>> {
    const { Op } = require('sequelize');
    const appConfig = (this.app.config as any).appConfig || {};
    const page = query.page && query.page > 0 ? query.page : 1;
    const pageSize = Math.min(
      query.pageSize && query.pageSize > 0 ? query.pageSize : (appConfig.pageSize || 20),
      appConfig.maxPageSize || 100,
    );
    const offset = (page - 1) * pageSize;

    // 将工具过滤条件通过 $tool.xxx$ 语法放到 outer WHERE，避免 include.where 的一些边界问题
    const outerWhere: any = { userId };
    if (query.categoryCode) {
      outerWhere['$tool.category_code$'] = query.categoryCode;
    }
    if (query.keyword) {
      const like = { [Op.like]: `%${query.keyword}%` };
      outerWhere[Op.and] = [
        {
          [Op.or]: [
            { '$tool.name$': like },
            { '$tool.description$': like },
            { '$tool.keyword$': like },
          ],
        },
      ];
    }

    const include: any[] = [
      {
        model: this.ctx.model.Tool,
        as: 'tool',
        required: true,
        include: [
          {
            model: this.ctx.model.ToolCategory,
            as: 'category',
            required: false,
            attributes: ['id', 'code', 'name'],
          },
        ],
      },
    ];

    const { count, rows } = await this.ctx.model.UserToolFavorite.findAndCountAll({
      where: outerWhere,
      include,
      order: [['sort', 'ASC'], ['favoritedAt', 'DESC'], ['id', 'DESC']],
      limit: pageSize,
      offset,
      distinct: true,
      col: 'id',
      subQuery: false,
    } as any);

    return {
      list: rows.map((row: any) => this.toFavoriteDto(row.toJSON ? row.toJSON() : row)),
      total: count,
      page,
      pageSize,
      totalPages: Math.ceil(count / pageSize),
    };
  }

  /**
   * GET /api/favorites/codes — 已收藏的 toolCode 集合（供前端批量标注）
   */
  async listFavoriteCodes(userId: number): Promise<string[]> {
    const rows = await this.ctx.model.UserToolFavorite.findAll({
      where: { userId },
      attributes: ['toolCode'],
      order: [['sort', 'ASC'], ['id', 'ASC']],
    });
    return rows.map((r: any) => r.toolCode);
  }

  /**
   * GET /api/favorites/check/:toolCode — 单个工具收藏态
   */
  async checkFavorited(userId: number, toolCode: string): Promise<{ favorited: boolean; sort?: number; favoritedAt?: Date }> {
    const fav = await this.ctx.model.UserToolFavorite.findOne({
      where: { userId, toolCode },
      attributes: ['id', 'sort', 'favoritedAt'],
    });
    if (!fav) return { favorited: false };
    const j = (fav as any).toJSON();
    return { favorited: true, sort: j.sort, favoritedAt: j.favoritedAt };
  }

  /**
   * PUT /api/favorites/reorder — 手动拖拽排序
   * body: { orderedToolCodes: string[] }
   * 要求：orderedToolCodes 必须与当前用户全部收藏的 toolCode 集合严格相等
   */
  async reorderFavorites(userId: number, orderedToolCodes: string[]): Promise<{ affected: number }> {
    if (!Array.isArray(orderedToolCodes) || orderedToolCodes.length === 0) {
      this.ctx.throw(422, 'orderedToolCodes 必须是非空数组');
    }
    // 去重校验
    const uniqueCodes = new Set(orderedToolCodes);
    if (uniqueCodes.size !== orderedToolCodes.length) {
      this.ctx.throw(422, 'orderedToolCodes 含有重复项');
    }

    const currentAll = await this.ctx.model.UserToolFavorite.findAll({
      where: { userId },
      attributes: ['id', 'toolCode'],
    });
    const currentCodeSet = new Set(currentAll.map((r: any) => r.toolCode));

    if (currentCodeSet.size !== orderedToolCodes.length) {
      this.ctx.throw(400, '排序参数与当前收藏列表不匹配');
    }
    for (const code of orderedToolCodes) {
      if (!currentCodeSet.has(code)) {
        this.ctx.throw(400, `收藏记录不存在: ${code}`);
      }
    }

    // 事务中批量更新 sort，采用 SORT_STEP 间隔便于后续头插/中插
    await this.ctx.model.transaction(async (t: any) => {
      for (let i = 0; i < orderedToolCodes.length; i++) {
        await this.ctx.model.UserToolFavorite.update(
          { sort: (i + 1) * SORT_STEP },
          { where: { userId, toolCode: orderedToolCodes[i] }, transaction: t } as any,
        );
      }
    });

    return { affected: orderedToolCodes.length };
  }

  // ==================== 私有辅助 ====================

  /**
   * 通过 toolId 或 toolCode 定位一个可被收藏的工具
   * 工具必须 status=1（已发布），否则视为不可收藏
   */
  private async resolveTool(params: { toolId?: number; toolCode?: string }): Promise<any | null> {
    const where: any = { status: 1 };
    if (params.toolId) where.id = params.toolId;
    if (params.toolCode) where.code = params.toolCode;
    const tool = await this.ctx.model.Tool.findOne({ where });
    return tool ? (tool as any).toJSON() : null;
  }

  private toFavoriteDto(row: any): FavoriteToolDto {
    const tool = row.tool || {};
    return {
      id: row.id,
      toolId: row.toolId ?? row.tool_id,
      toolCode: row.toolCode ?? row.tool_code,
      sort: row.sort,
      favoritedAt: row.favoritedAt ?? row.favorited_at,
      tool: {
        id: tool.id,
        code: tool.code,
        name: tool.name,
        description: tool.description,
        keyword: tool.keyword,
        categoryCode: tool.categoryCode ?? tool.category_code,
        categoryName: tool.category?.name,
        icon: tool.icon,
        color: tool.color,
        path: tool.path,
        isFeature: tool.isFeature ?? tool.is_feature,
        requiredLevelCode: tool.requiredLevelCode ?? tool.required_level_code,
        requirePaid: tool.requirePaid ?? tool.require_paid,
        status: tool.status,
      },
    };
  }
}
