/**
 * 地区数据接口
 * 对接后端 /api/region/* 路由（行政区划三级联动）
 *
 * 数据结构：
 *   Region {
 *     id: string         // 行政区划编码，如 "440000"
 *     name: string       // 简称，如 "广东"
 *     fullname: string   // 全称，如 "广东省"
 *     pinyin: string
 *     lat: number
 *     lng: number
 *     hasArea: boolean
 *     cids: Region[]     // 子级
 *   }
 *
 * 设计：后端 /api/region/all 直接返回完整树（Redis 缓存 24h），
 *      前端在页面 mount 时一次性拉取，缓存于本地 store/state，
 *      RegionPicker 组件本身不发请求。
 */
import { request } from '@/utils';

const API_BASE = '/api/region';

export interface RegionNode {
  id: string;
  name: string;
  fullname: string;
  pinyin?: string;
  lat?: number;
  lng?: number;
  hasArea?: boolean;
  cids: RegionNode[];
}

export interface FlatRegionNode extends Omit<RegionNode, 'cids'> {
  parentId: string | null;
  cids: RegionNode[];
}

interface RegionApiResp<T> {
  code: number;
  msg?: string;
  data?: T;
}

/** 获取完整省市区树（一次性，结构较大但后端有 Redis 缓存） */
export const getAllRegions = (): Promise<RegionApiResp<RegionNode[]>> =>
  request.get(`${API_BASE}/all`);

/** 获取省份列表（不含子级） */
export const getProvinces = (): Promise<RegionApiResp<Omit<RegionNode, 'cids'>[]>> =>
  request.get(`${API_BASE}/provinces`);

/** 获取某节点子级列表 */
export const getRegionChildren = (parentId: string): Promise<RegionApiResp<RegionNode[]>> =>
  request.get(`${API_BASE}/children/${encodeURIComponent(parentId)}`);

/** 获取完整行政路径文本，如 "广东省/深圳市/南山区" */
export const getRegionPath = (id: string): Promise<RegionApiResp<string>> =>
  request.get(`${API_BASE}/path/${encodeURIComponent(id)}`);

/** 根据 ID 查询单个节点（含 parentId） */
export const getRegionById = (id: string): Promise<RegionApiResp<FlatRegionNode>> =>
  request.get(`${API_BASE}/${encodeURIComponent(id)}`);

/**
 * 搜索地区（中文/拼音）—— 备用，组件默认使用本地索引搜索（更快、无网络依赖）
 * @param keyword 关键词
 * @param type    'name' 中文 | 'pinyin' 拼音，默认 name
 */
export const searchRegions = (
  keyword: string,
  type: 'name' | 'pinyin' = 'name',
): Promise<RegionApiResp<FlatRegionNode[]>> => {
  const qs = new URLSearchParams({ keyword, type });
  return request.get(`${API_BASE}/search?${qs.toString()}`);
};
