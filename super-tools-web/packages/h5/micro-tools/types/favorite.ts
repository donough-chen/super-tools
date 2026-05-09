/**
 * 收藏模块类型定义
 *
 * 与后端 /api/favorites/* 返回结构严格对齐
 * 后端设计文档: super-tool-node/docs/superpowers/specs/2026-05-08-用户收藏工具模块设计文档.md
 */
import type { Tool, Pagination } from './tool';

/**
 * 单条收藏记录（list 接口返回的 item）
 *
 * 注：`tool` 嵌套对象比 Tool 基础类型多一个 `categoryName` 字段（后端 JOIN 得到）
 */
export interface Favorite {
  id: number;
  toolId: number;
  toolCode: string;
  sort: number;
  favoritedAt: string;
  tool: Tool & { categoryName?: string };
}

/** 收藏列表分页结构 */
export type FavoriteListResult = Pagination<Favorite>;

/** GET /api/favorites/check/:toolCode 返回 */
export interface FavoriteCheckResult {
  favorited: boolean;
  sort?: number;
  favoritedAt?: string;
}

/** POST /api/favorites 返回 data */
export interface AddFavoriteResult {
  id: number;
  toolId: number;
  toolCode: string;
  sort: number;
}

/** PUT /api/favorites/reorder 返回 data */
export interface ReorderResult {
  affected: number;
}
