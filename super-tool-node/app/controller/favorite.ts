import BaseController from './base';

/**
 * 用户收藏工具 Controller
 * 路由前缀: /api/favorites
 * 所有接口均需登录
 */
export default class FavoriteController extends BaseController {

  /** POST /api/favorites — 收藏工具 */
  async create() {
    this.validate({
      toolId: { type: 'int', required: false, min: 1 },
      toolCode: { type: 'string', required: false, allowEmpty: false },
    });
    const userId = (this.ctx.state.user as any).id;
    const { toolId, toolCode } = this.ctx.request.body as any;

    if (!toolId && !toolCode) {
      this.ctx.throw(422, '必须提供 toolId 或 toolCode');
    }

    const data = await this.service.favorite.addFavorite(userId, { toolId, toolCode });
    this.created(data, '收藏成功');
  }

  /** DELETE /api/favorites/:toolCode — 取消收藏 */
  async destroy() {
    const userId = (this.ctx.state.user as any).id;
    const toolCode = String(this.ctx.params.toolCode);
    await this.service.favorite.removeFavorite(userId, toolCode);
    this.success(null, '取消收藏成功');
  }

  /** GET /api/favorites — 分页收藏列表（支持 keyword/categoryCode） */
  async index() {
    const userId = (this.ctx.state.user as any).id;
    const pagination = this.getPagination();
    const { keyword, categoryCode } = this.ctx.query;
    const result = await this.service.favorite.listFavorites(userId, {
      ...pagination,
      keyword: keyword ? String(keyword) : undefined,
      categoryCode: categoryCode ? String(categoryCode) : undefined,
    });
    this.paginated(result);
  }

  /** GET /api/favorites/codes — 已收藏工具 code 集合（轻量查询） */
  async codes() {
    const userId = (this.ctx.state.user as any).id;
    const list = await this.service.favorite.listFavoriteCodes(userId);
    this.success(list);
  }

  /** GET /api/favorites/check/:toolCode — 单个工具收藏态 */
  async check() {
    const userId = (this.ctx.state.user as any).id;
    const toolCode = String(this.ctx.params.toolCode);
    const data = await this.service.favorite.checkFavorited(userId, toolCode);
    this.success(data);
  }

  /** PUT /api/favorites/reorder — 手动拖拽排序 */
  async reorder() {
    this.validate({
      orderedToolCodes: {
        type: 'array',
        itemType: 'string',
        required: true,
        min: 1,
      },
    });
    const userId = (this.ctx.state.user as any).id;
    const { orderedToolCodes } = this.ctx.request.body as any;
    const data = await this.service.favorite.reorderFavorites(userId, orderedToolCodes);
    this.success(data, '排序已更新');
  }
}
