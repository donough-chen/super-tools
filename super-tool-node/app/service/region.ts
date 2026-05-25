import { Service } from 'egg'
import * as fs from 'fs'
import * as path from 'path'
import {
  Region,
  FlatRegion,
  RegionLite,
  RegionSearchIndexItem,
  RegionSearchItem,
  RegionSearchResult,
} from '../types/region'

// Redis Key 常量
const REDIS_KEY = {
  ALL: 'region:all',
  FLAT: 'region:flat',
  SEARCH_INDEX: 'region:search-index',
} as const

const REDIS_TTL = 60 * 60 * 24 // 24小时，单位秒

/** 搜索默认/最大返回条数 */
const SEARCH_DEFAULT_LIMIT = 100
const SEARCH_MAX_LIMIT = 500

export default class RegionService extends Service {
  // -------------------------
  // 私有方法：数据初始化
  // -------------------------

  /**
   * 从 JSON 文件读取原始数据
   */
  private loadFromFile(): Region[] {
    const filePath = path.join(this.app.baseDir, 'app/data/regions.json')
    const raw = fs.readFileSync(filePath, 'utf-8')
    return JSON.parse(raw) as Region[]
  }

  /**
   * 递归构建扁平化 Map
   */
  private buildFlatMap(
    nodes: Region[],
    flatMap: Map<string, FlatRegion>,
    parentId: string | null = null,
  ): void {
    for (const node of nodes) {
      const { cids, ...rest } = node
      flatMap.set(node.id, { ...rest, cids, parentId })
      if (cids?.length) {
        this.buildFlatMap(cids, flatMap, node.id)
      }
    }
  }

  /**
   * 获取完整树形数据（优先读 Redis，未命中则读文件并写入 Redis）
   */
  private async getTreeData(): Promise<Region[]> {
    const { app } = this
    const cached = await app.redis.get(REDIS_KEY.ALL)

    if (cached) {
      return JSON.parse(cached) as Region[]
    }

    // 缓存未命中，从文件加载
    const data = this.loadFromFile()
    await app.redis.set(REDIS_KEY.ALL, JSON.stringify(data), 'EX', REDIS_TTL)
    return data
  }

  /**
   * 获取扁平化 Map（优先读 Redis）
   */
  private async getFlatMap(): Promise<Map<string, FlatRegion>> {
    const { app } = this
    const cached = await app.redis.get(REDIS_KEY.FLAT)

    const flatMap = new Map<string, FlatRegion>()

    if (cached) {
      const entries = JSON.parse(cached) as [string, FlatRegion][]
      entries.forEach(([key, value]) => flatMap.set(key, value))
      return flatMap
    }

    // 缓存未命中，重新构建
    const data = this.loadFromFile()
    this.buildFlatMap(data, flatMap)

    // Map 序列化存入 Redis
    await app.redis.set(
      REDIS_KEY.FLAT,
      JSON.stringify([...flatMap.entries()]),
      'EX',
      REDIS_TTL,
    )

    return flatMap
  }

  /**
   * 把 Region 节点转为不含 cids 的轻量结构
   */
  private toLite(node: Region): RegionLite {
    const { cids: _cids, ...rest } = node
    return rest
  }

  /**
   * 构建搜索索引（拍平 tree，三级节点全部入索引）
   *
   * 与前端 RegionPicker 的 buildSearchIndex 行为完全一致：
   * - 每个省/市/区节点都生成一条索引
   * - matchText: name + fullname 拼接（小写）—— 用于中文/英文混合匹配
   * - matchPinyin: 自上而下逐级拼音拼接（去空格、小写）—— 用于拼音匹配
   * - pathText: "广东省 / 深圳市 / 南山区" —— 前端 results-path 直接展示
   */
  private buildSearchIndexFromTree(tree: Region[]): RegionSearchIndexItem[] {
    const list: RegionSearchIndexItem[] = []

    for (const province of tree) {
      const pName = province.name || province.fullname || ''
      const pPinyin = (province.pinyin || '').replace(/\s+/g, '').toLowerCase()
      const pPath = province.fullname || pName
      const pLite = this.toLite(province)

      list.push({
        level: 'province',
        leafId: province.id,
        fullname: province.fullname || pName,
        pathText: pPath,
        province: pLite,
        matchText: `${pName}${province.fullname || ''}`.toLowerCase(),
        matchPinyin: pPinyin,
      })

      for (const city of province.cids || []) {
        const cName = city.name || city.fullname || ''
        const cPinyin = (city.pinyin || '').replace(/\s+/g, '').toLowerCase()
        const cPath = `${province.fullname || pName} / ${city.fullname || cName}`
        const cLite = this.toLite(city)

        list.push({
          level: 'city',
          leafId: city.id,
          fullname: city.fullname || cName,
          pathText: cPath,
          province: pLite,
          city: cLite,
          matchText: `${cName}${city.fullname || ''}`.toLowerCase(),
          matchPinyin: `${pPinyin}${cPinyin}`,
        })

        for (const district of city.cids || []) {
          const dName = district.name || district.fullname || ''
          const dPinyin = (district.pinyin || '').replace(/\s+/g, '').toLowerCase()
          const dPath = `${province.fullname || pName} / ${city.fullname || cName} / ${district.fullname || dName}`
          const dLite = this.toLite(district)

          list.push({
            level: 'district',
            leafId: district.id,
            fullname: district.fullname || dName,
            pathText: dPath,
            province: pLite,
            city: cLite,
            district: dLite,
            matchText: `${dName}${district.fullname || ''}`.toLowerCase(),
            matchPinyin: `${pPinyin}${cPinyin}${dPinyin}`,
          })
        }
      }
    }

    return list
  }

  /**
   * 获取搜索索引（优先读 Redis，未命中则基于 tree 构建并写入）
   *
   * 索引相对较大（每级一条），但仅一份数据；24h 缓存后续查询直接走内存。
   */
  private async getSearchIndex(): Promise<RegionSearchIndexItem[]> {
    const { app } = this
    const cached = await app.redis.get(REDIS_KEY.SEARCH_INDEX)
    if (cached) {
      return JSON.parse(cached) as RegionSearchIndexItem[]
    }

    const tree = await this.getTreeData()
    const index = this.buildSearchIndexFromTree(tree)
    await app.redis.set(
      REDIS_KEY.SEARCH_INDEX,
      JSON.stringify(index),
      'EX',
      REDIS_TTL,
    )
    return index
  }

  /** 把内部索引项转为对外搜索结果项（剥离 matchText / matchPinyin） */
  private toSearchItem(item: RegionSearchIndexItem): RegionSearchItem {
    return {
      level: item.level,
      leafId: item.leafId,
      fullname: item.fullname,
      pathText: item.pathText,
      province: item.province,
      city: item.city,
      district: item.district,
    }
  }

  /** 判断关键字是否纯英文/字母/数字（视为拼音） */
  private isPinyinKeyword(kw: string): boolean {
    return /^[a-z0-9\s]+$/i.test(kw)
  }

  // -------------------------
  // 公开方法：业务接口
  // -------------------------

  /**
   * 获取完整树形数据
   */
  async getAll(): Promise<Region[]> {
    return this.getTreeData()
  }

  /**
   * 获取省份列表（去除 cids）
   */
  async getProvinces(): Promise<Omit<Region, 'cids'>[]> {
    const data = await this.getTreeData()
    return data.map(({ cids: _cids, ...rest }) => rest)
  }

  /**
   * 根据 ID 查询节点
   */
  async getById(id: string): Promise<FlatRegion | null> {
    const flatMap = await this.getFlatMap()
    return flatMap.get(id) ?? null
  }

  /**
   * 获取某节点的子级列表
   */
  async getChildren(parentId: string): Promise<Region[]> {
    const flatMap = await this.getFlatMap()
    const parent = flatMap.get(parentId)
    return parent?.cids ?? []
  }

  /**
   * 统一搜索（对齐前端 RegionPicker 的搜索行为，作为后续其他页面的兜底接口）
   *
   * 行为：
   * 1. 自动判断关键字类型：纯字母 → 拼音匹配 + 中文匹配兜底；含中文 → 仅中文匹配
   * 2. 命中范围覆盖省/市/区三级，结果含完整路径节点 + 路径文本，前端可直接用于定位
   * 3. 排序：按 level 优先级（province → city → district）+ 索引天然顺序
   * 4. 限制条数：默认 100，最大 500；返回 total 让前端可提示"还有 N 条"
   *
   * @param keyword 搜索关键词（中文或拼音）
   * @param limit   返回条数上限（1 ~ 500，默认 100）
   */
  async search(keyword: string, limit?: number): Promise<RegionSearchResult> {
    const trimmed = (keyword || '').trim()
    const safeLimit = Math.max(
      1,
      Math.min(SEARCH_MAX_LIMIT, Number(limit) || SEARCH_DEFAULT_LIMIT),
    )

    if (!trimmed) {
      return { list: [], total: 0, limit: safeLimit, keyword: '' }
    }

    const index = await this.getSearchIndex()
    const lowerKw = trimmed.toLowerCase()
    const isPinyin = this.isPinyinKeyword(trimmed)

    const hits: RegionSearchIndexItem[] = []
    for (const item of index) {
      const matched = isPinyin
        ? item.matchPinyin.includes(lowerKw) || item.matchText.includes(lowerKw)
        : item.matchText.includes(lowerKw)
      if (matched) hits.push(item)
    }

    return {
      list: hits.slice(0, safeLimit).map(it => this.toSearchItem(it)),
      total: hits.length,
      limit: safeLimit,
      keyword: trimmed,
    }
  }

  /**
   * @deprecated 历史接口，保留以兼容旧调用；新调用请使用 search(keyword, limit)
   * 根据名称/全称搜索（仅中文匹配）
   */
  async searchByName(keyword: string): Promise<FlatRegion[]> {
    const flatMap = await this.getFlatMap()
    const result: FlatRegion[] = []
    for (const node of flatMap.values()) {
      if (node.name.includes(keyword) || node.fullname.includes(keyword)) {
        result.push(node)
      }
    }
    return result
  }

  /**
   * @deprecated 历史接口，保留以兼容旧调用；新调用请使用 search(keyword, limit)
   * 根据拼音搜索
   */
  async searchByPinyin(keyword: string): Promise<FlatRegion[]> {
    const flatMap = await this.getFlatMap()
    const result: FlatRegion[] = []
    const lowerKeyword = keyword.toLowerCase()
    for (const node of flatMap.values()) {
      if (node.pinyin?.includes(lowerKeyword)) {
        result.push(node)
      }
    }
    return result
  }

  /**
   * 获取完整行政路径，如：河北省 / 石家庄市 / 长安区
   */
  async getPath(id: string): Promise<string> {
    const flatMap = await this.getFlatMap()
    const pathArr: string[] = []
    let current = flatMap.get(id)

    while (current) {
      pathArr.unshift(current.fullname)
      current = current.parentId ? flatMap.get(current.parentId) : undefined
    }

    return pathArr.join('/')
  }

  /**
   * 手动刷新缓存（行政区划变更时调用）
   */
  async refreshCache(): Promise<void> {
    const { app } = this
    await app.redis.del(REDIS_KEY.ALL)
    await app.redis.del(REDIS_KEY.FLAT)
    await app.redis.del(REDIS_KEY.SEARCH_INDEX)

    // 重新预热
    await this.getTreeData()
    await this.getFlatMap()
    await this.getSearchIndex()

    this.logger.info('[RegionService] 地区缓存已刷新（含搜索索引）')
  }
}