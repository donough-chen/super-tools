/**
 * 工具模块类型定义
 *
 * 与后端 /api/tools/* 返回结构严格对齐
 */

/** 用户成长等级码 */
export type LevelCode = 'free' | 'silver' | 'gold' | 'diamond' | 'black';

/** 后端 Tool 实体 */
export interface Tool {
  id: number;
  code: string;
  name: string;
  description?: string;
  keyword?: string;
  categoryId: number;
  categoryCode: string;
  icon?: string;
  color?: string;
  path: string;
  isFeature: 0 | 1;
  requiredLevelCode: LevelCode;
  requirePaid: 0 | 1;
  status: 0 | 1;
  sort: number;
  createdAt?: string;
  updatedAt?: string;
}

/** 工具分类 */
export interface ToolCategory {
  id: number;
  code: string;
  name: string;
  icon?: string;
  description?: string;
  sort: number;
  status: 0 | 1;
  /** 仅聚合模式存在 */
  tools?: Tool[];
}

/** 通用分页结构 */
export interface Pagination<T> {
  list: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/** 首页聚合结果 */
export interface HomeAggregateResult {
  mode: 'aggregate';
  categories: Array<ToolCategory & { tools: Tool[] }>;
}

/** 首页分页结果 */
export interface HomePaginatedResult {
  mode: 'paginated';
  categories: ToolCategory[];
  tools: Pagination<Tool>;
}

export type HomeResult = HomeAggregateResult | HomePaginatedResult;

/** 权限校验结果 */
export interface AccessResult {
  allowed: boolean;
  reason?: 'need_level' | 'need_paid' | 'paid_expired';
  required?: { levelCode: LevelCode; levelName: string; requirePaid: boolean };
  current?: { levelCode: LevelCode; isPaid: boolean };
  tool?: { code: string; name: string; path: string };
}
