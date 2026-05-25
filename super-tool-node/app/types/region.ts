export interface Region {
  id: string
  name: string
  fullname: string
  pinyin: string
  lat: number
  lng: number
  hasArea: boolean
  cids: Region[]
}

// 扁平化节点（含父级 ID）
export interface FlatRegion extends Omit<Region, 'cids'> {
  parentId: string | null
  cids: Region[] // 保留原始子级，方便 getChildren
}

// 接口响应
export interface RegionResponse<T = unknown> {
  code: number
  msg?: string
  data?: T
}

// ============================================================
// 搜索相关（对齐前端 RegionPicker 的 SearchIndexItem 字段）
// ============================================================

export type RegionLevel = 'province' | 'city' | 'district'

/** 不含 cids 的轻量节点（搜索结果使用，避免把整棵子树带回前端） */
export type RegionLite = Omit<Region, 'cids'>

/** 搜索结果项 */
export interface RegionSearchItem {
  /** 命中层级 */
  level: RegionLevel
  /** 末级 id（用于直接定位） */
  leafId: string
  /** 末级 fullname（如"南山区"） */
  fullname: string
  /** 完整行政路径文本（如"广东省 / 深圳市 / 南山区"，与前端展示一致） */
  pathText: string
  /** 完整路径节点（前端可直接用于 setPickerValue 定位） */
  province: RegionLite
  city?: RegionLite
  district?: RegionLite
}

/** 搜索响应数据 */
export interface RegionSearchResult {
  list: RegionSearchItem[]
  total: number
  limit: number
  keyword: string
}

/** 内部索引项（不对外，含原始匹配字段） */
export interface RegionSearchIndexItem extends RegionSearchItem {
  /** 用于中文匹配（小写、name+fullname 拼接） */
  matchText: string
  /** 用于拼音匹配（小写、无空格、自上而下逐级拼接） */
  matchPinyin: string
}