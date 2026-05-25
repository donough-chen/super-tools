import { Controller } from 'egg'

export default class RegionController extends Controller {
  /**
   * GET /api/region/all
   * 获取完整树形数据
   */
  async getAll() {
    const { ctx } = this
    const data = await ctx.service.region.getAll()
    ctx.body = { code: 0, data }
  }

  /**
   * GET /api/region/provinces
   * 获取省份列表
   */
  async getProvinces() {
    const { ctx } = this
    const data = await ctx.service.region.getProvinces()
    ctx.body = { code: 0, data }
  }

  /**
   * GET /api/region/children/:parentId
   * 获取子级列表
   */
  async getChildren() {
    const { ctx } = this
    const { parentId } = ctx.params

    if (!parentId) {
      ctx.body = { code: 400, msg: '缺少 parentId 参数' }
      return
    }

    const data = await ctx.service.region.getChildren(parentId)
    ctx.body = { code: 0, data }
  }

  /**
   * GET /api/region/path/:id
   * 获取完整行政路径
   */
  async getPath() {
    const { ctx } = this
    const { id } = ctx.params
    const data = await ctx.service.region.getPath(id)
    ctx.body = { code: 0, data }
  }

  /**
   * GET /api/region/search?keyword=xxx&limit=100
   * 统一搜索（对齐前端 RegionPicker 行为，作为后续页面的兜底接口）
   *
   * 入参：
   *   - keyword 必填，中文或拼音均可（后端自动判别）
   *   - limit   选填，默认 100，最大 500
   *
   * 返回：
   *   { code: 0, data: { list: RegionSearchItem[], total, limit, keyword } }
   *   - list[i].level         命中层级 'province' | 'city' | 'district'
   *   - list[i].leafId        末级 id（用于直接定位）
   *   - list[i].fullname      末级 fullname（如"南山区"）
   *   - list[i].pathText      "广东省 / 深圳市 / 南山区" —— 直接展示
   *   - list[i].province/city/district  完整路径节点（不含 cids，前端可直接 setPickerValue）
   *   - total                 命中总数（用于"还有 N 条"提示）
   *
   * 兼容：仍接受 type=name|pinyin 但已忽略（后端自动判别），不会报错。
   */
  async search() {
    const { ctx } = this
    const { keyword, limit } = ctx.query

    if (!keyword) {
      ctx.body = { code: 400, msg: '缺少 keyword 参数' }
      return
    }

    const data = await ctx.service.region.search(
      String(keyword),
      limit !== undefined ? Number(limit) : undefined,
    )

    ctx.body = { code: 0, data }
  }

  /**
   * GET /api/region/:id
   * 根据 ID 查询节点
   */
  async getById() {
    const { ctx } = this
    const { id } = ctx.params
    const data = await ctx.service.region.getById(id)

    if (!data) {
      ctx.body = { code: 404, msg: `未找到 ID 为 ${id} 的地区` }
      return
    }

    ctx.body = { code: 0, data }
  }

  /**
   * POST /api/region/refresh-cache
   * 手动刷新缓存（建议加权限校验）
   */
  async refreshCache() {
    const { ctx } = this
    await ctx.service.region.refreshCache()
    ctx.body = { code: 0, msg: '缓存刷新成功' }
  }
}