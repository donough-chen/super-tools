import BaseController from './base';

/**
 * H5 端工具 Controller
 * 路由前缀: /api/tools
 */
export default class ToolController extends BaseController {

  /** GET /api/tools/home — 首页聚合/分页双模式 */
  async home() {
    const { categoryCode, keyword, page, pageSize } = this.ctx.query;
    const data = await this.service.tool.getHomeData({
      categoryCode: categoryCode ? String(categoryCode) : undefined,
      keyword: keyword ? String(keyword) : undefined,
      page: page ? Number(page) : undefined,
      pageSize: pageSize ? Number(pageSize) : undefined,
    });
    this.success(data);
  }

  /** GET /api/tools/feature — 特色 Tab */
  async featureList() {
    const pagination = this.getPagination();
    const result = await this.service.tool.getFeatureTools(pagination);
    this.paginated(result);
  }

  /** GET /api/tools/member — 会员专属 Tab */
  async memberList() {
    const pagination = this.getPagination();
    const result = await this.service.tool.getMemberTools(pagination);
    this.paginated(result);
  }

  /** GET /api/tools/:code/access — 使用前权限校验（需登录） */
  async checkAccess() {
    const userId = (this.ctx.state.user as any)?.id;
    if (!userId) this.ctx.throw(401, '请提供认证Token');
    const code = String(this.ctx.params.code);
    const data = await this.service.tool.checkToolAccess(userId, code);
    this.success(data);
  }
}
